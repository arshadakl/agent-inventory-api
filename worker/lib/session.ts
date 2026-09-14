import { encodeBase64Url } from "./encoding";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

const SESSION_TOKEN_BYTES = 32;

export function createSessionToken(): string {
  return encodeBase64Url(
    crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES)),
  );
}

export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return encodeBase64Url(new Uint8Array(digest));
}
