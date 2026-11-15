const UNIQUE = "P2002";
const RAW_OR_UNMAPPED = new Set(["P2010", "P2039"]);

export function isUniqueViolation(error: unknown, seen = new Set<unknown>()): boolean {
  if (!isRecord(error) || seen.has(error)) {
    return false;
  }

  seen.add(error);
  const code = error.code;

  if (code === UNIQUE) {
    return true;
  }

  if (
    typeof code === "string" &&
    RAW_OR_UNMAPPED.has(code) &&
    typeof error.message === "string" &&
    error.message.includes("23505")
  ) {
    return true;
  }

  return isUniqueViolation(error.cause, seen);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
