/**
 * Great-circle distance between two WGS84 coordinates using the Haversine formula.
 * Accurate to well under a meter at campus scale.
 */
const EARTH_RADIUS_METERS = 6_371_000;
const toRadians = (deg: number) => (deg * Math.PI) / 180;

export const haversineDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
};

export interface ParsedLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/** Validate an untrusted location payload. Returns null if it is missing or malformed. */
export const parseLocation = (value: unknown): ParsedLocation | null => {
  if (!value || typeof value !== "object") return null;
  const { latitude, longitude, accuracy } = value as Record<string, unknown>;
  const lat = Number(latitude);
  const lon = Number(longitude);
  const acc = Number(accuracy);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return null;
  if (!Number.isFinite(acc) || acc < 0) return null;
  return { latitude: lat, longitude: lon, accuracy: acc };
};
