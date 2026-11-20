import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  UPLOAD_URL_EXPIRY_SECONDS,
  DOWNLOAD_URL_EXPIRY_SECONDS,
} from "@/lib/validations/attachment";

export const ATTACHMENTS_BUCKET = "caize-todo-attachments";

export interface ISupabaseStorageAdapter {
  createSignedUploadUrl(
    storagePath: string,
    expiresIn?: number
  ): Promise<{ signedUrl: string; token: string }>;
  createSignedDownloadUrl(
    storagePath: string,
    downloadFilename: string,
    expiresIn?: number
  ): Promise<{ signedUrl: string }>;
  fetchLeadingBytes(storagePath: string, byteCount?: number): Promise<Uint8Array | null>;
  removeObjects(storagePaths: string[]): Promise<boolean>;
  ensureBucketExists(): Promise<void>;
}

export class SupabaseStorageAdapter implements ISupabaseStorageAdapter {
  private client: SupabaseClient | null = null;
  private readonly bucket: string;

  constructor(bucket: string = ATTACHMENTS_BUCKET) {
    this.bucket = bucket;
  }

  private getClient(): SupabaseClient {
    if (this.client) {
      return this.client;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Supabase storage requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
      );
    }

    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    return this.client;
  }

  /**
   * Generates a restricted, single-use signed upload URL for the exact storage path.
   */
  async createSignedUploadUrl(
    storagePath: string,
    expiresIn: number = UPLOAD_URL_EXPIRY_SECONDS
  ): Promise<{ signedUrl: string; token: string }> {
    const client = this.getClient();
    const { data, error } = await client.storage
      .from(this.bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      throw new Error(`Failed to create signed upload URL: ${error?.message || "Unknown storage error"}`);
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
    };
  }

  /**
   * Generates a short-lived signed download URL enforcing Content-Disposition attachment.
   */
  async createSignedDownloadUrl(
    storagePath: string,
    downloadFilename: string,
    expiresIn: number = DOWNLOAD_URL_EXPIRY_SECONDS
  ): Promise<{ signedUrl: string }> {
    const client = this.getClient();
    const { data, error } = await client.storage
      .from(this.bucket)
      .createSignedUrl(storagePath, expiresIn, {
        download: downloadFilename,
      });

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create signed download URL: ${error?.message || "Unknown storage error"}`);
    }

    return {
      signedUrl: data.signedUrl,
    };
  }

  /**
   * Fetches leading bytes of an object for magic-byte binary signature verification.
   */
  async fetchLeadingBytes(
    storagePath: string,
    byteCount: number = 32
  ): Promise<Uint8Array | null> {
    try {
      const client = this.getClient();
      // Download the file range
      const { data, error } = await client.storage
        .from(this.bucket)
        .download(storagePath);

      if (error || !data) {
        return null;
      }

      const arrayBuffer = await data.slice(0, byteCount).arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch {
      return null;
    }
  }

  /**
   * Removes objects from the private storage bucket in batch.
   */
  async removeObjects(storagePaths: string[]): Promise<boolean> {
    if (storagePaths.length === 0) return true;
    try {
      const client = this.getClient();
      const { error } = await client.storage.from(this.bucket).remove(storagePaths);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Idempotently ensures the private attachment bucket exists with strict security settings.
   */
  async ensureBucketExists(): Promise<void> {
    const client = this.getClient();
    const { data: buckets } = await client.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === this.bucket);

    if (!exists) {
      await client.storage.createBucket(this.bucket, {
        public: false, // Strictly private
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
      });
    }
  }
}

export const supabaseStorageAdapter = new SupabaseStorageAdapter();
