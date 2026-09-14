export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength = (4 - (base64.length % 4)) % 4;
  const binary = atob(base64.padEnd(base64.length + paddingLength, "="));

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
