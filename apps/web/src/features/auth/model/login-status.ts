export type LoginStatus = "cancelled" | "error" | "loading" | null;

export function parseLoginStatus(rawStatus: string | string[] | undefined): LoginStatus {
  const statusValue = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

  if (statusValue === "cancelled" || statusValue === "error" || statusValue === "loading") {
    return statusValue;
  }

  return null;
}
