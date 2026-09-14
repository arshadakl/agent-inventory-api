import { MAX_PASSWORD_LENGTH } from "@shared/schemas/auth";

import { decodeBase64Url, encodeBase64Url } from "./encoding";

const ALGORITHM = "pbkdf2_sha256";
const HASH_BYTES = 32;
// Cloudflare Workers supports PBKDF2 iteration counts up to 100,000.
const ITERATIONS = 100_000;
const MAX_STORED_ITERATIONS = 100_000;
const MIN_STORED_ITERATIONS = 100_000;
const SALT_BYTES = 16;

const textEncoder = new TextEncoder();

export async function hashPassword(password: string): Promise<string> {
  assertPasswordLength(password);

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derivePasswordHash(password, salt, ITERATIONS);

  return [
    ALGORITHM,
    ITERATIONS,
    encodeBase64Url(salt),
    encodeBase64Url(hash),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }

  const parsedHash = parseStoredHash(storedHash);

  if (!parsedHash) {
    return false;
  }

  const actualHash = await derivePasswordHash(
    password,
    parsedHash.salt,
    parsedHash.iterations,
  );

  return constantTimeEqual(actualHash, parsedHash.hash);
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    key,
    HASH_BYTES * 8,
  );

  return new Uint8Array(bits);
}

interface ParsedPasswordHash {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

function parseStoredHash(value: string): ParsedPasswordHash | null {
  const [algorithm, iterationsValue, saltValue, hashValue, unexpectedPart] =
    value.split("$");
  const iterations = Number(iterationsValue);

  if (
    algorithm !== ALGORITHM ||
    unexpectedPart !== undefined ||
    !saltValue ||
    !hashValue ||
    !Number.isSafeInteger(iterations) ||
    iterations < MIN_STORED_ITERATIONS ||
    iterations > MAX_STORED_ITERATIONS
  ) {
    return null;
  }

  try {
    const salt = decodeBase64Url(saltValue);
    const hash = decodeBase64Url(hashValue);

    if (salt.length !== SALT_BYTES || hash.length !== HASH_BYTES) {
      return null;
    }

    return { iterations, salt, hash };
  } catch {
    return null;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (const [index, leftByte] of left.entries()) {
    difference |= leftByte ^ (right[index] ?? 0);
  }

  return difference === 0;
}

function assertPasswordLength(password: string): void {
  if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    throw new RangeError(
      `Password must contain between 1 and ${MAX_PASSWORD_LENGTH} characters.`,
    );
  }
}
