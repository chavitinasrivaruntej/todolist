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

  constructor(
    invitationRepo: IInvitationRepository = defaultInvitationRepo,
    listRepo: ITodoListRepository = defaultListRepo,
    memberRepo: IListMemberRepository = defaultMemberRepo,
    permissionService: ListPermissionService = defaultPermissionService,
    emailService: IEmailService = defaultEmailService
  ) {
    this.invitationRepo = invitationRepo;
    this.listRepo = listRepo;
    this.memberRepo = memberRepo;
    this.permissionService = permissionService;
    this.emailService = emailService;
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
   * Creates or renews an invitation and dispatches the invitation email.
   * Only the OWNER of the list can invite collaborators.
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

    // Lookup inviter's email
    const [inviterUser] = await db.execute(sql`
      SELECT email FROM auth.users WHERE id = ${invitation.inviterId}::uuid LIMIT 1;
    `) as unknown as Array<{ email: string }>;

    return {
      listId: list.id,
      listName: list.name,
      inviterEmail: inviterUser?.email ?? "List Owner",
      role: invitation.role,
      targetEmail: invitation.email,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accepts an invitation and provisions membership.
   * Validates token expiration and enforces email matching against the session.
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

    return {
      success: true,
      listId: list.id,
      listName: list.name,
    };
  }

  /**
   * Revokes an invitation before it is accepted.
   * Only the OWNER of the list can revoke invitations.
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

    return { success: true, id: invitationId };
  }
}

export const invitationService = new InvitationService();

