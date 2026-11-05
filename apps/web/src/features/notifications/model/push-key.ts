const PUBLIC_KEY_BYTES = 65;

export function decodeVapidPublicKey(value: string): Uint8Array<ArrayBuffer> | null {
  const trimmed = value.trim();

  if (trimmed.length < 80 || trimmed.length > 100 || !/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return null;
  }

  const padding = "=".repeat((4 - (trimmed.length % 4)) % 4);
  const base64 = `${trimmed}${padding}`.replaceAll("-", "+").replaceAll("_", "/");

  let binary: string;

  try {
    binary = atob(base64);
  } catch {
    return null;
  }

  if (binary.length !== PUBLIC_KEY_BYTES) {
    return null;
  }

  const bytes = new Uint8Array(PUBLIC_KEY_BYTES);

  for (let index = 0; index < PUBLIC_KEY_BYTES; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  if (bytes[0] !== 0x04) {
    return null;
  }

  return bytes;
}

export function readWebPushPublicKey(): string {
  return process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";
}
