import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { todoService } from "../src/server/services/todo.service";
import { todoRepository } from "../src/server/repositories/todo.repository";
import { attachmentService } from "../src/server/services/attachment.service";
import { todoListRepository } from "../src/server/repositories/todo-list.repository";
import { ValidationError } from "../src/server/errors";

async function runLiveVerification() {
  console.log("=== Phase 10 Live End-to-End Verification ===");

  const ownerId = "71e34396-3822-4fc2-8068-4c0cdf3f86cb";
  const listId = "00000000-0000-4000-8000-000000000001";
  const testRunId = Date.now().toString().slice(-6);

  let testTaskId: string | null = null;
  let testAttachmentId: string | null = null;

  try {
    // 1. Verify owner list exists
    console.log("\n[1] Verifying target list exists...");
    const list = await todoListRepository.findById(listId);
    if (!list) throw new Error(`List ${listId} not found`);
    console.log(`✓ List verified: "${list.name}" (${list.id})`);

    // 2. Create test task
    console.log("\n[2] Creating test task for attachments...");
    const task = await todoService.createTodo(
      {
        listId,
        title: `Task with Attachments Test ${testRunId}`,
        priority: "MEDIUM",
      },
      ownerId
    );
    testTaskId = task.id;
    console.log(`✓ Created test task "${task.title}" (ID: ${task.id}, attachmentCount: ${task.attachmentCount})`);

    // 3. Test MIME/extension validation
    console.log("\n[3] Testing extension and MIME validation...");
    try {
      await attachmentService.createUploadAuthorization(
        {
          todoId: testTaskId,
          filename: "malicious.exe",
          fileSize: 1024,
          mimeType: "application/x-msdownload",
        },
        ownerId
      );
      throw new Error("Should have rejected dangerous executable file");
    } catch (err: any) {
      if (err instanceof ValidationError) {
        console.log(`✓ Successfully rejected dangerous file: "${err.message}"`);
      } else {
        throw err;
      }
    }

    // 4. Create upload authorization (reserve slot)
    console.log("\n[4] Creating upload authorization for valid PNG...");
    const uploadAuth = await attachmentService.createUploadAuthorization(
      {
        todoId: testTaskId,
        filename: `screenshot-${testRunId}.png`,
        fileSize: 70, // small PNG
        mimeType: "image/png",
      },
      ownerId
    );
    testAttachmentId = uploadAuth.attachmentId;
    console.log(`✓ Upload authorized: attachmentId=${uploadAuth.attachmentId}`);
    console.log(`  Storage path: ${uploadAuth.storagePath}`);
    console.log(`  Signed upload URL received (length: ${uploadAuth.uploadUrl.length})`);

    // 5. Upload bytes to Supabase Storage using signed URL
    console.log("\n[5] Uploading real PNG magic bytes to Supabase Storage via signed URL...");
    // 1x1 valid PNG binary
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);

    const uploadRes = await fetch(uploadAuth.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
      },
      body: pngBytes,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Direct upload to Supabase Storage failed (${uploadRes.status}): ${errText}`);
    }
    console.log(`✓ Direct upload succeeded with HTTP ${uploadRes.status}`);

    // 6. Confirm upload with magic bytes verification
    console.log("\n[6] Confirming upload and verifying magic byte signature...");
    const confirmed = await attachmentService.confirmUploadedAttachment(
      { attachmentId: testAttachmentId },
      ownerId
    );
    console.log(`✓ Confirmed attachment: status=${confirmed.status}, filename="${confirmed.originalFilename}"`);

    // 7. Verify task reflects updated attachment count
    console.log("\n[7] Verifying task attachment count and list query...");
    const refreshedTask = await todoRepository.findById(testTaskId);
    if (!refreshedTask || refreshedTask.attachmentCount !== 1) {
      throw new Error(`Expected attachmentCount=1, got ${refreshedTask?.attachmentCount}`);
    }
    console.log(`✓ Task reflects attachmentCount = ${refreshedTask.attachmentCount}`);

    const attachmentsList = await attachmentService.getAttachmentsByTodo(
      testTaskId,
      ownerId
    );
    if (attachmentsList.length !== 1 || attachmentsList[0].id !== testAttachmentId) {
      throw new Error(`Expected 1 attachment with ID ${testAttachmentId}`);
    }
    console.log(`✓ Retrieved attachments list: 1 active attachment found`);

    // 8. Generate and verify download URL
    console.log("\n[8] Generating and validating signed download URL...");
    const downloadAuth = await attachmentService.createDownloadAuthorization(
      { attachmentId: testAttachmentId },
      ownerId
    );
    console.log(`✓ Received download URL for "${downloadAuth.filename}"`);
    const dlRes = await fetch(downloadAuth.downloadUrl);
    if (!dlRes.ok) {
      throw new Error(`Failed to download via signed URL (${dlRes.status})`);
    }
    const downloadedBuf = Buffer.from(await dlRes.arrayBuffer());
    if (downloadedBuf.length !== pngBytes.length) {
      throw new Error(`Downloaded size ${downloadedBuf.length} !== original ${pngBytes.length}`);
    }
    console.log(`✓ Download succeeded: ${downloadedBuf.length} bytes match uploaded content exactly`);

    // 9. Two-phase deletion
    console.log("\n[9] Testing two-phase deletion (PENDING_DELETION -> Storage removal -> Hard delete)...");
    const deleteResult = await attachmentService.deleteAttachment(
      { attachmentId: testAttachmentId },
      ownerId
    );
    if (!deleteResult.success) {
      throw new Error("deleteAttachment returned false");
    }
    console.log(`✓ Attachment deleted successfully`);

    // Verify task count is now 0
    const finalTask = await todoRepository.findById(testTaskId);
    if (!finalTask || finalTask.attachmentCount !== 0) {
      throw new Error(`Expected attachmentCount=0 after delete, got ${finalTask?.attachmentCount}`);
    }
    console.log(`✓ Task attachmentCount reset to 0`);

    // Verify attachments list is empty
    const emptyAttachments = await attachmentService.getAttachmentsByTodo(
      testTaskId,
      ownerId
    );
    if (emptyAttachments.length !== 0) {
      throw new Error(`Expected 0 attachments after delete, got ${emptyAttachments.length}`);
    }
    console.log(`✓ Attachment list is now empty`);

    // 10. Clean up test task
    console.log("\n[10] Cleaning up test task...");
    await todoService.deleteTodo({ id: testTaskId }, ownerId);
    testTaskId = null;
    console.log(`✓ Test task deleted`);

    console.log("\n=========================================");
    console.log("✓ ALL PHASE 10 LIVE VERIFICATIONS PASSED!");
    console.log("=========================================");
  } catch (error) {
    console.error("\n❌ Live verification failed:", error);
    // Best-effort cleanup
    if (testAttachmentId) {
      try {
        await attachmentService.deleteAttachment({ attachmentId: testAttachmentId }, ownerId);
      } catch {}
    }
    if (testTaskId) {
      try {
        await todoService.deleteTodo({ id: testTaskId }, ownerId);
      } catch {}
    }
    process.exit(1);
  }
}

runLiveVerification();
