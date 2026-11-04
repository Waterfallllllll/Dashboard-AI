import {
  DEVICE_LOCATION_STORAGE_KEY,
  parseStoredLocation,
  type DeviceLocation
} from "./device-location";

const listeners = new Set<() => void>();
let snapshot: DeviceLocation | null | undefined;
let loaded = false;

export function getDeviceLocationSnapshot(): DeviceLocation | null {
  loadLocation();
  return snapshot ?? null;
}

export function getDeviceLocationServerSnapshot(): DeviceLocation | null {
  return null;
}

export function subscribeDeviceLocation(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function saveDeviceLocation(location: DeviceLocation | null): boolean {
  loadLocation();

  try {
    if (location) {
      window.localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, JSON.stringify(location));
    } else {
      window.localStorage.removeItem(DEVICE_LOCATION_STORAGE_KEY);
    }
  } catch {
    return false;
  }

  snapshot = location;
  emit();
  return true;
}

export function resetDeviceLocationStoreForTests(): void {
  loaded = false;
  snapshot = undefined;
}

function loadLocation(): void {
  if (loaded || typeof window === "undefined") {
    return;
  }

  loaded = true;

  try {
    snapshot = parseStoredLocation(window.localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY));
  } catch {
    snapshot = null;
  }
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== DEVICE_LOCATION_STORAGE_KEY) {
    return;
  }

  snapshot = parseStoredLocation(event.newValue);
  loaded = true;
  emit();
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}
