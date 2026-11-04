export {
  locationFromCoordinates,
  locationLabel,
  parseCity,
  reduceCoordinate,
  type DeviceLocation
} from "./model/device-location";
export {
  getDeviceLocationServerSnapshot,
  getDeviceLocationSnapshot,
  resetDeviceLocationStoreForTests,
  saveDeviceLocation,
  subscribeDeviceLocation
} from "./model/device-location-store";
