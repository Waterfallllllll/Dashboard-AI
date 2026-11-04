export const DEVICE_LOCATION_STORAGE_KEY = "evergreen-device-location";
export const CITY_MAX_LENGTH = 80;

export type DeviceLocation =
  | Readonly<{ kind: "city"; city: string }>
  | Readonly<{ kind: "coordinates"; latitude: number; longitude: number }>;

export function reduceCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseCity(value: string): string | null {
  const city = Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .trim();

  if (city.length < 1 || city.length > CITY_MAX_LENGTH) {
    return null;
  }

  return city;
}

export function locationFromCoordinates(
  latitude: number,
  longitude: number
): DeviceLocation | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }

  return {
    kind: "coordinates",
    latitude: reduceCoordinate(latitude),
    longitude: reduceCoordinate(longitude)
  };
}

export function locationLabel(location: DeviceLocation | null): string | null {
  if (!location) {
    return null;
  }

  if (location.kind === "city") {
    return location.city;
  }

  return `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
}

export function parseStoredLocation(rawValue: string | null): DeviceLocation | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (typeof parsedValue !== "object" || parsedValue === null) {
      return null;
    }

    const record = parsedValue as Record<string, unknown>;

    if (record.kind === "city" && typeof record.city === "string") {
      const city = parseCity(record.city);
      return city ? { kind: "city", city } : null;
    }

    if (record.kind === "coordinates") {
      return locationFromCoordinates(Number(record.latitude), Number(record.longitude));
    }
  } catch {
    return null;
  }

  return null;
}
