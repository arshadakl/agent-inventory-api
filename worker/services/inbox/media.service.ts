const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/3gpp",
  "audio/ogg",
  "audio/mpeg",
  "audio/aac",
  "audio/mp4",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

export function isUnderSizeLimit(size: number): boolean {
  return size > 0 && size <= MAX_UPLOAD_BYTES;
}

export function buildR2Key(messageId: string, filename: string): string {
  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `inbox/${messageId}/${timestamp}_${safeFilename}`;
}

export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream,
  mimeType: string,
): Promise<{ key: string; size: number }> {
  const result = await bucket.put(key, body, {
    httpMetadata: { contentType: mimeType },
  });

  return { key: result!.key, size: result!.size };
}

export async function getFromR2(
  bucket: R2Bucket,
  key: string,
): Promise<R2ObjectBody | null> {
  const object = await bucket.get(key);

  if (!object) return null;

  return object as R2ObjectBody;
}

export async function deleteFromR2(
  bucket: R2Bucket,
  key: string,
): Promise<void> {
  await bucket.delete(key);
}
