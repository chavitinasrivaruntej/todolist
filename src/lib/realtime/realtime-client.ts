import { createClient } from "@/lib/supabase/client";
import {
  type RealtimeEventEnvelope,
  type CollaboratorPresenceState,
  getListRealtimeTopic,
} from "./realtime-events";
import { type RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeConnectionStatus =
  | "IDLE"
  | "CONNECTING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "UNAVAILABLE";

export interface CreateChannelOptions {
  listId: string;
  initialPresence?: CollaboratorPresenceState;
  onEvent: (event: RealtimeEventEnvelope) => void;
  onPresenceSync: (presences: CollaboratorPresenceState[]) => void;
  onPresenceJoin?: (presences: CollaboratorPresenceState[]) => void;
  onPresenceLeave?: (presences: CollaboratorPresenceState[]) => void;
  onStatusChange: (status: RealtimeConnectionStatus) => void;
  onReconnected?: () => void;
}

/**
 * Initializes and manages a private Supabase Realtime channel subscription for a given list.
 */
export function subscribeToListChannel(options: CreateChannelOptions): {
  channel: RealtimeChannel | null;
  updatePresence: (partial: Partial<CollaboratorPresenceState>) => Promise<void>;
  unsubscribe: () => void;
} {
  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    options.onStatusChange("UNAVAILABLE");
    return {
      channel: null,
      updatePresence: async () => {},
      unsubscribe: () => {},
    };
  }

  const topic = getListRealtimeTopic(options.listId);
  options.onStatusChange("CONNECTING");

  let currentPresence = options.initialPresence;
  let hasConnectedOnce = false;

  const channel = supabase.channel(topic, {
    config: {
      private: true,
      broadcast: { self: true },
      presence: { key: currentPresence ? `${currentPresence.userId}:${currentPresence.sessionId}` : "" },
    },
  });

  // Listen to all broadcast events on this list channel
  channel.on("broadcast", { event: "*" }, (message: { payload: RealtimeEventEnvelope }) => {
    if (message.payload && message.payload.eventType) {
      options.onEvent(message.payload);
    }
  });

  // Listen to presence updates
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState<CollaboratorPresenceState>();
    const allPresences: CollaboratorPresenceState[] = [];
    for (const key of Object.keys(state)) {
      const presences = state[key];
      if (presences && Array.isArray(presences)) {
        for (const p of presences) {
          allPresences.push(p);
        }
      }
    }
    options.onPresenceSync(allPresences);
  });

  channel.on("presence", { event: "join" }, ({ newPresences }) => {
    if (options.onPresenceJoin && Array.isArray(newPresences)) {
      options.onPresenceJoin(newPresences as unknown as CollaboratorPresenceState[]);
    }
  });

  channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
    if (options.onPresenceLeave && Array.isArray(leftPresences)) {
      options.onPresenceLeave(leftPresences as unknown as CollaboratorPresenceState[]);
    }
  });

  // Handle window network events
  const handleOnline = () => {
    options.onStatusChange("CONNECTING");
  };

  const handleOffline = () => {
    options.onStatusChange("DISCONNECTED");
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  // Subscribe to channel
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      const isReconnection = hasConnectedOnce;
      hasConnectedOnce = true;
      options.onStatusChange("CONNECTED");

      if (currentPresence) {
        try {
          await channel.track(currentPresence);
        } catch {
          // Track failure is handled by presence sync
        }
      }

      if (isReconnection && options.onReconnected) {
        options.onReconnected();
      }
    } else if (status === "CLOSED") {
      options.onStatusChange("DISCONNECTED");
    } else if (status === "CHANNEL_ERROR") {
      options.onStatusChange("UNAVAILABLE");
    } else if (status === "TIMED_OUT") {
      options.onStatusChange("DISCONNECTED");
    }
  });

  return {
    channel,
    updatePresence: async (partial: Partial<CollaboratorPresenceState>) => {
      if (currentPresence) {
        currentPresence = { ...currentPresence, ...partial };
        try {
          await channel.track(currentPresence);
        } catch {
          // Ignore
        }
      }
    },
    unsubscribe: () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
      try {
        channel.untrack();
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {
        // Safe cleanup
      }
      options.onStatusChange("IDLE");
    },
  };
}
