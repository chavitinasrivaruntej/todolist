import crypto from "crypto";
import {
  type IInvitationRepository,
  invitationRepository as defaultInvitationRepo,
} from "@/server/repositories/invitation.repository";
import {
  type ITodoListRepository,
  todoListRepository as defaultListRepo,
} from "@/server/repositories/todo-list.repository";
import {
  type IListMemberRepository,
  listMemberRepository as defaultMemberRepo,
} from "@/server/repositories/list-member.repository";
import {
  ListPermissionService,
  listPermissionService as defaultPermissionService,
} from "@/server/services/list-permission.service";
import {
  type IEmailService,
  emailService as defaultEmailService,
} from "@/server/services/email/email.service";
import {
  ActivityService,
  activityService as defaultActivityService,
} from "@/server/services/activity.service";
import {
  NotificationService,
  notificationService as defaultNotificationService,
} from "@/server/services/notification.service";
import {
  type IRealtimePublisherService,
  realtimePublisherService as defaultRealtimePublisher,
} from "@/server/services/realtime-publisher.service";
import {
  type InviteCollaboratorInput,
} from "@/lib/validations/sharing";
import { NotFoundError, ValidationError } from "@/server/errors";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export class InvitationService {
  private readonly invitationRepo: IInvitationRepository;
  private readonly listRepo: ITodoListRepository;
  private readonly memberRepo: IListMemberRepository;
  private readonly permissionService: ListPermissionService;
  private readonly emailService: IEmailService;
  private readonly activityService: ActivityService;
  private readonly notificationService: NotificationService;
  private readonly realtimePublisher: IRealtimePublisherService;

  constructor(
    invitationRepo: IInvitationRepository = defaultInvitationRepo,
    listRepo: ITodoListRepository = defaultListRepo,
    memberRepo: IListMemberRepository = defaultMemberRepo,
    permissionService: ListPermissionService = defaultPermissionService,
    emailService: IEmailService = defaultEmailService,
    activityService: ActivityService = defaultActivityService,
    notificationService: NotificationService = defaultNotificationService,
    realtimePublisher: IRealtimePublisherService = defaultRealtimePublisher
  ) {
    this.invitationRepo = invitationRepo;
    this.listRepo = listRepo;
    this.memberRepo = memberRepo;
    this.permissionService = permissionService;
    this.emailService = emailService;
    this.activityService = activityService;
    this.notificationService = notificationService;
    this.realtimePublisher = realtimePublisher;
  }

  /**
   * Hashes a raw token with SHA-256.
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Generates a 32-byte cryptographically secure hex token.
   */
  private generateRawToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Creates or renews an invitation, dispatches the email, logs activity,
   * and creates an in-app notification if the invitee is registered.
   */
  async createInvitation(
    input: InviteCollaboratorInput,
    inviterId: string,
    inviterEmail: string
  ): Promise<{ success: boolean; invitationId: string; invitationUrl: string }> {
    await this.permissionService.requireOwner(inviterId, input.listId);

    const list = await this.listRepo.findById(input.listId);
    if (!list) {
      throw new NotFoundError(`Todo list with ID ${input.listId} was not found.`);
    }

    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Invariant: Cannot invite oneself
    if (inviterEmail.toLowerCase() === normalizedEmail) {
      throw new ValidationError("You cannot invite yourself to your own list.");
    }

    // 2. Invariant: Check if invitee is already an accepted member
    const existingMembers = await this.memberRepo.findAllByListId(input.listId);
    const isAlreadyMember = existingMembers.some(
      (m) => m.email?.toLowerCase() === normalizedEmail
    );
    if (isAlreadyMember) {
      throw new ValidationError(
        `User ${normalizedEmail} is already a member of this list.`
      );
    }

    // 3. Cryptographic token generation & expiration
    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 4. Check for existing pending invitation to renew
    const existingPending = await this.invitationRepo.findPendingByEmailAndList(
      normalizedEmail,
      input.listId
    );

    let invitationId: string;
    if (existingPending) {
      const updated = await this.invitationRepo.updateTokenAndExpiry(
        existingPending.id,
        {
          tokenHash,
          role: input.role,
          expiresAt,
        }
      );
      invitationId = updated ? updated.id : existingPending.id;
    } else {
      const created = await this.invitationRepo.create({
        listId: input.listId,
        inviterId,
        email: normalizedEmail,
        role: input.role,
        tokenHash,
        expiresAt,
      });
      invitationId = created.id;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const invitationUrl = `${appUrl}/invite/${rawToken}`;

    // 5. Dispatch email
    await this.emailService.sendInvitationEmail({
      to: normalizedEmail,
      inviterEmail,
      listName: list.name,
      role: input.role,
      invitationUrl,
    });

    // 6. Log collaboration activity
    try {
      await this.activityService.logActivity({
        listId: input.listId,
        actorId: inviterId,
        action: "INVITATION_CREATED",
        entityType: "INVITATION",
        entityId: invitationId,
        metadata: {
          email: normalizedEmail,
          role: input.role,
        },
      });
    } catch {
      // Safe fallback in mock tests
    }

    // 7. In-app notification for registered users
    try {
      await this.notificationService.notifyInvitationReceived({
        listId: input.listId,
        listName: list.name,
        inviterId,
        inviterEmail,
        inviteeEmail: normalizedEmail,
        role: input.role,
      });
    } catch {
      // Safe fallback in mock tests
    }

    return {
      success: true,
      invitationId,
      invitationUrl,
    };
  }

  /**
   * Inspects an invitation token safely, returning metadata for the acceptance screen.
   */
  async inspectInvitation(token: string): Promise<{
    listId: string;
    listName: string;
    inviterEmail: string;
    role: "EDITOR" | "VIEWER";
    targetEmail: string;
    expiresAt: Date;
  }> {
    const tokenHash = this.hashToken(token.trim());
    const invitation = await this.invitationRepo.findByTokenHash(tokenHash);

    if (!invitation) {
      throw new NotFoundError("This invitation link is invalid or has expired.");
    }

    if (invitation.status !== "PENDING") {
      throw new ValidationError(
        `This invitation has already been ${invitation.status.toLowerCase()}.`
      );
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      await this.invitationRepo.updateStatus(invitation.id, "EXPIRED");
      throw new ValidationError("This invitation has expired. Please ask the owner for a new invite.");
    }

    const list = await this.listRepo.findById(invitation.listId);
    if (!list) {
      throw new NotFoundError("The associated Todo list was not found.");
    }

    let inviterEmail = "List Owner";
    try {
      if (process.env.DATABASE_URL) {
        const rows = (await db.execute(sql`
          SELECT email FROM auth.users WHERE id = ${invitation.inviterId}::uuid LIMIT 1;
        `)) as unknown as Array<{ email: string }>;
        if (rows[0]?.email) inviterEmail = rows[0].email;
      }
    } catch {
      // Fallback
    }

    return {
      listId: list.id,
      listName: list.name,
      inviterEmail,
      role: invitation.role,
      targetEmail: invitation.email,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accepts an invitation, provisions membership, logs activity, and notifies owner.
   */
  async acceptInvitation(
    token: string,
    userId: string,
    userEmail: string
  ): Promise<{ success: boolean; listId: string; listName: string }> {
    const tokenHash = this.hashToken(token.trim());
    const invitation = await this.invitationRepo.findByTokenHash(tokenHash);

    if (!invitation) {
      throw new NotFoundError("This invitation link is invalid or has expired.");
    }

    if (invitation.status !== "PENDING") {
      throw new ValidationError(
        `This invitation has already been ${invitation.status.toLowerCase()}.`
      );
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      await this.invitationRepo.updateStatus(invitation.id, "EXPIRED");
      throw new ValidationError("This invitation has expired.");
    }

    // Enforce email matching between invitee and authenticated session
    if (userEmail.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ValidationError(
        `This invitation was sent to ${invitation.email}. You are currently signed in as ${userEmail}. Please sign in with the invited email address.`
      );
    }

    const list = await this.listRepo.findById(invitation.listId);
    if (!list) {
      throw new NotFoundError("The associated Todo list no longer exists.");
    }

    // Owner cannot accept an invite to their own list
    if (list.userId === userId) {
      await this.invitationRepo.updateStatus(invitation.id, "ACCEPTED", new Date());
      return { success: true, listId: list.id, listName: list.name };
    }

    // Check if already a member
    const existingMember = await this.memberRepo.findByListAndUser(
      invitation.listId,
      userId
    );

    if (!existingMember) {
      await this.memberRepo.addMember({
        listId: invitation.listId,
        userId,
        role: invitation.role,
      });
    }

    await this.invitationRepo.updateStatus(invitation.id, "ACCEPTED", new Date());

    // Log activity: INVITATION_ACCEPTED and MEMBER_JOINED
    try {
      await this.activityService.logActivity({
        listId: invitation.listId,
        actorId: userId,
        action: "INVITATION_ACCEPTED",
        entityType: "INVITATION",
        entityId: invitation.id,
        metadata: {
          email: userEmail,
          role: invitation.role,
        },
      });

      await this.activityService.logActivity({
        listId: invitation.listId,
        actorId: userId,
        action: "MEMBER_JOINED",
        entityType: "MEMBER",
        metadata: {
          email: userEmail,
          role: invitation.role,
        },
      });
    } catch {
      // Safe fallback
    }

    // Notify list owner
    if (list.userId) {
      try {
        await this.notificationService.notifyInvitationAccepted({
          listId: list.id,
          listName: list.name,
          acceptorId: userId,
          acceptorEmail: userEmail,
          ownerId: list.userId,
        });
      } catch {
        // Safe fallback
      }
    }

    // Broadcast COLLABORATOR_CHANGED (ADDED)
    try {
      await this.realtimePublisher.publishCollaboratorChanged(
        list.id,
        userId,
        null,
        "ADDED",
        userId,
        invitation.role
      );
    } catch {
      // Safe fallback
    }

    return {
      success: true,
      listId: list.id,
      listName: list.name,
    };
  }

  /**
   * Revokes an invitation, logs activity, and notifies invitee if registered.
   */
  async revokeInvitation(
    invitationId: string,
    userId: string
  ): Promise<{ success: boolean; id: string }> {
    const invitation = await this.invitationRepo.findById(invitationId);
    if (!invitation) {
      throw new NotFoundError("Invitation record was not found.");
    }

    await this.permissionService.requireOwner(userId, invitation.listId);

    const revoked = await this.invitationRepo.updateStatus(invitationId, "REVOKED");
    if (!revoked) {
      throw new NotFoundError("Failed to revoke invitation.");
    }

    const list = await this.listRepo.findById(invitation.listId);

    // Log activity
    try {
      await this.activityService.logActivity({
        listId: invitation.listId,
        actorId: userId,
        action: "INVITATION_REVOKED",
        entityType: "INVITATION",
        entityId: invitation.id,
        metadata: {
          email: invitation.email,
          role: invitation.role,
        },
      });
    } catch {
      // Safe fallback
    }

    // Notify invitee if registered
    let actorEmail = "Owner";
    try {
      if (process.env.DATABASE_URL) {
        const rows = (await db.execute(sql`
          SELECT email FROM auth.users WHERE id = ${userId}::uuid LIMIT 1;
        `)) as unknown as Array<{ email: string }>;
        if (rows[0]?.email) actorEmail = rows[0].email;
      }
    } catch {
      // Safe fallback
    }

    try {
      await this.notificationService.notifyInvitationRevoked({
        listId: invitation.listId,
        listName: list?.name ?? "Todo List",
        actorId: userId,
        actorEmail,
        inviteeEmail: invitation.email,
      });
    } catch {
      // Safe fallback
    }

    return { success: true, id: invitationId };
  }
}

export const invitationService = new InvitationService();
