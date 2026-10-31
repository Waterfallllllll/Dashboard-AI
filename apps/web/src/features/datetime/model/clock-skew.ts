export const CLOCK_SKEW_THRESHOLD_MS = 60_000;

export const CLOCK_SKEW_NOTICE =
  "Время устройства отличается от серверного больше чем на минуту.";

export function hasClockSkew(localNow: number, serverNow: number): boolean {
  return Math.abs(localNow - serverNow) > CLOCK_SKEW_THRESHOLD_MS;
}

export function getMockServerNow(localNow: number): number {
  return localNow;
}
