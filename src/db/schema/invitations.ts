import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { todoLists } from "./lists";
import type { ListMemberRole } from "./members";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

/**
 * ListInvitations Table Definition
 * 
 * Stores invitation tokens sent to prospective collaborators (registered or unregistered).
 * For security, only the SHA-256 hash of the token is stored in the database.
 */
export const listInvitations = pgTable(
  "list_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .notNull()
      .references(() => todoLists.id, { onDelete: "cascade" }),
    inviterId: uuid("inviter_id").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().$type<ListMemberRole>(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 })
      .default("PENDING")
      .notNull()
      .$type<InvitationStatus>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("list_invitations_token_hash_unique").on(table.tokenHash),
    index("list_invitations_list_status_idx").on(table.listId, table.status),
    index("list_invitations_email_status_idx").on(table.email, table.status),
  ]
);

export type ListInvitation = typeof listInvitations.$inferSelect;
export type NewListInvitation = typeof listInvitations.$inferInsert;

