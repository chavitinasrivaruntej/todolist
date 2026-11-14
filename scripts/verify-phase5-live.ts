import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { db } from "../src/db";
import { sql } from "drizzle-orm";
import { listInvitations } from "../src/db/schema/invitations";
import { listMembers } from "../src/db/schema/members";
import { invitationService } from "../src/server/services/invitation.service";
import { listPermissionService } from "../src/server/services/list-permission.service";
import { todoListRepository } from "../src/server/repositories/todo-list.repository";
import { listMemberRepository } from "../src/server/repositories/list-member.repository";
import { invitationRepository } from "../src/server/repositories/invitation.repository";
import { ValidationError, NotFoundError } from "../src/server/errors";
import crypto from "crypto";

async function runLiveVerification() {
  console.log("=== Phase 5 Live End-to-End Verification ===");

  const ownerId = "71e34396-3822-4fc2-8068-4c0cdf3f86cb";
  const ownerEmail = "chavithinavaruntej@gmail.com";
  const listId = "00000000-0000-4000-8000-000000000001";
  const testInviteeEmail = "collaborator.test@caize.internal";
  const dummyCollaboratorId = "88888888-8888-4888-8888-888888888888";

  // Step 1: Verify database tables & list ownership
  console.log("\n[1] Verifying schema and owner list...");
  const list = await todoListRepository.findById(listId);
  if (!list || list.userId !== ownerId) {
    throw new Error(`Owner list validation failed: ${JSON.stringify(list)}`);
  }
  console.log(`✓ List "${list.name}" (${list.id}) verified for owner ${ownerEmail}`);

  // Step 2: Test invitation creation
  console.log("\n[2] Testing invitation creation and cryptographic hashing...");
  await db.execute(sql`
    DELETE FROM list_invitations WHERE list_id = ${listId}::uuid AND email = ${testInviteeEmail};
  `);
  const inviteResult = await invitationService.createInvitation(
    {
      listId,
      email: testInviteeEmail,
      role: "EDITOR",
    },
    ownerId,
    ownerEmail
  );
  console.log(`✓ Invitation dispatched successfully: ID ${inviteResult.invitationId}`);

  // Extract raw token from URL
  const rawToken = inviteResult.invitationUrl.split("/invite/")[1];
  if (!rawToken || rawToken.length !== 64) {
    throw new Error(`Invalid raw token format generated: ${rawToken}`);
  }
  console.log(`✓ 32-byte cryptographic hex token generated (${rawToken.length} chars)`);

  // Step 3: Verify Zero-Token-Leakage in Database
  console.log("\n[3] Verifying zero token leakage in PostgreSQL...");
  const [tokenSearch] = await db.execute(sql`
    SELECT id, token_hash FROM list_invitations WHERE token_hash = ${rawToken};
  `) as unknown as Array<any>;
  if (tokenSearch) {
    throw new Error("CRITICAL SECURITY FLAW: Raw token found in token_hash column!");
  }

  const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const [hashSearch] = await db.execute(sql`
    SELECT id, token_hash, status, role FROM list_invitations WHERE token_hash = ${expectedHash};
  `) as unknown as Array<{ id: string; token_hash: string; status: string; role: string }>;
  if (!hashSearch) {
    throw new Error("SHA-256 token hash was not found in database!");
  }
  console.log(`✓ Cryptographic SHA-256 hash verified in database (${hashSearch.token_hash.slice(0, 16)}...)`);

  // Step 4: Test public invitation inspection
  console.log("\n[4] Testing public invitation inspection...");
  const inspectData = await invitationService.inspectInvitation(rawToken);
  if (
    inspectData.listName !== list.name ||
    inspectData.role !== "EDITOR" ||
    inspectData.targetEmail !== testInviteeEmail
  ) {
    throw new Error(`Inspect invitation mismatch: ${JSON.stringify(inspectData)}`);
  }
  console.log(`✓ Public inspection returns valid metadata for ${inspectData.targetEmail}`);

  // Step 5: Test email mismatch rejection
  console.log("\n[5] Testing strict email mismatch enforcement on acceptance...");
  let mismatchCaught = false;
  try {
    await invitationService.acceptInvitation(
      rawToken,
      "impostor-uuid",
      "impostor@gmail.com"
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      mismatchCaught = true;
      console.log(`✓ Email mismatch correctly rejected: "${err.message}"`);
    }
  }
  if (!mismatchCaught) {
    throw new Error("Security failure: Impostor email was allowed to accept invitation!");
  }

  // Step 6: Test role permission enforcement (Owner, Editor, Viewer)
  console.log("\n[6] Testing ListPermissionService role resolution and matrix...");
  const ownerRole = await listPermissionService.getUserRole(ownerId, listId);
  if (ownerRole !== "OWNER") {
    throw new Error(`Expected OWNER role, got ${ownerRole}`);
  }
  await listPermissionService.requireOwner(ownerId, listId);
  await listPermissionService.requireCanMutateTodos(ownerId, listId);
  await listPermissionService.requireCanReadList(ownerId, listId);
  console.log("✓ OWNER role has full control");

  // Step 7: Simulate member provisioning & role switching
  console.log("\n[7] Simulating member provisioning and permission restrictions...");
  // Create temporary test user in auth.users to satisfy foreign key constraint
  await db.execute(sql`
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud, instance_id)
    VALUES (
      ${dummyCollaboratorId}::uuid,
      ${testInviteeEmail},
      '{}'::jsonb,
      'authenticated',
      'authenticated',
      '00000000-0000-0000-0000-000000000000'::uuid
    )
    ON CONFLICT (id) DO NOTHING;
  `);

  const member = await listMemberRepository.addMember({
    listId,
    userId: dummyCollaboratorId,
    role: "EDITOR",
  });
  console.log(`✓ Added collaborator member as EDITOR: ID ${member.id}`);

  const editorRole = await listPermissionService.getUserRole(dummyCollaboratorId, listId);
  if (editorRole !== "EDITOR") throw new Error(`Expected EDITOR, got ${editorRole}`);
  await listPermissionService.requireCanMutateTodos(dummyCollaboratorId, listId);
  console.log("✓ EDITOR role can mutate tasks");

  let ownerBlocked = false;
  try {
    await listPermissionService.requireOwner(dummyCollaboratorId, listId);
  } catch (err) {
    if (err instanceof ValidationError) {
      ownerBlocked = true;
      console.log(`✓ EDITOR blocked from owner actions: "${err.message}"`);
    }
  }
  if (!ownerBlocked) throw new Error("EDITOR was able to bypass requireOwner!");

  // Switch collaborator to VIEWER
  await listMemberRepository.updateRole(member.id, "VIEWER");
  const viewerRole = await listPermissionService.getUserRole(dummyCollaboratorId, listId);
  if (viewerRole !== "VIEWER") throw new Error(`Expected VIEWER, got ${viewerRole}`);
  await listPermissionService.requireCanReadList(dummyCollaboratorId, listId);
  console.log("✓ VIEWER role can read list");

  let mutateBlocked = false;
  try {
    await listPermissionService.requireCanMutateTodos(dummyCollaboratorId, listId);
  } catch (err) {
    if (err instanceof ValidationError) {
      mutateBlocked = true;
      console.log(`✓ VIEWER blocked from task mutations: "${err.message}"`);
    }
  }
  if (!mutateBlocked) throw new Error("VIEWER was able to bypass requireCanMutateTodos!");

  // Step 8: Clean up test artifacts
  console.log("\n[8] Cleaning up test invitation and membership records...");
  await listMemberRepository.deleteMember(member.id);
  await db.execute(sql`DELETE FROM auth.users WHERE id = ${dummyCollaboratorId}::uuid;`);
  await invitationRepository.delete(inviteResult.invitationId);
  console.log("✓ Test records cleaned up successfully");

  console.log("\n=======================================================");
  console.log("ALL PHASE 5 LIVE SECURITY & FUNCTIONAL CHECKS PASSED!");
  console.log("=======================================================");
  process.exit(0);
}

runLiveVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
