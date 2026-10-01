import crypto from "crypto";
import { config } from "../config/env";
import { FACE_CONFIG } from "../config/verification";

/**
 * Face identity math + embedding protection.
 *
 * Descriptors are generated in the browser by face-api.js (128 floats per face).
 * The server is the only place where descriptors are compared, so the client can never
 * decide "matched" or "confidence" on its own.
 */

export type FaceFailureCode =
  | "INVALID_DESCRIPTOR"
  | "INCONSISTENT_SAMPLES"
  | "ENROLLMENT_MISSING"
  | "FACE_MISMATCH";

export class FaceError extends Error {
  constructor(public code: FaceFailureCode, message: string, public statusCode = 422) {
    super(message);
  }
}

/** Validate an untrusted descriptor coming from the request body. */
export const parseDescriptor = (value: unknown): number[] => {
  if (!Array.isArray(value) || value.length !== FACE_CONFIG.descriptorLength) {
    throw new FaceError(
      "INVALID_DESCRIPTOR",
      `Face descriptor must contain exactly ${FACE_CONFIG.descriptorLength} numbers.`,
      400
    );
  }
  const descriptor = value.map(Number);
  if (descriptor.some((v) => !Number.isFinite(v) || Math.abs(v) > 1)) {
    throw new FaceError("INVALID_DESCRIPTOR", "Face descriptor contains invalid values.", 400);
  }
  const norm = Math.sqrt(descriptor.reduce((sum, v) => sum + v * v, 0));
  const mean = descriptor.reduce((sum, v) => sum + v, 0) / descriptor.length;
  const variance = descriptor.reduce((sum, v) => sum + (v - mean) ** 2, 0) / descriptor.length;
  if (norm < 0.2 || norm > 5 || variance < 1e-6) {
    throw new FaceError("INVALID_DESCRIPTOR", "Face descriptor is not a valid face embedding.", 400);
  }
  return descriptor;
};

export const euclideanDistance = (a: number[], b: number[]): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
};

/** Confidence shown to users: similarity = 1 - distance, clamped to [0, 1]. */
export const distanceToConfidence = (distance: number): number =>
  Math.round(Math.max(0, Math.min(1, 1 - distance)) * 100) / 100;

/**
 * Enrollment: several samples captured a moment apart must agree with each other.
 * Returns the averaged descriptor that will be stored.
 */
export const buildEnrollmentDescriptor = (rawSamples: unknown): { descriptor: number[]; sampleCount: number; maxSpread: number } => {
  if (
    !Array.isArray(rawSamples) ||
    rawSamples.length < FACE_CONFIG.minEnrollmentSamples ||
    rawSamples.length > FACE_CONFIG.maxEnrollmentSamples
  ) {
    throw new FaceError(
      "INVALID_DESCRIPTOR",
      `Provide between ${FACE_CONFIG.minEnrollmentSamples} and ${FACE_CONFIG.maxEnrollmentSamples} face samples.`,
      400
    );
  }
  const samples = rawSamples.map(parseDescriptor);

  let maxSpread = 0;
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      maxSpread = Math.max(maxSpread, euclideanDistance(samples[i], samples[j]));
    }
  }
  if (maxSpread > FACE_CONFIG.enrollmentConsistencyThreshold) {
    throw new FaceError(
      "INCONSISTENT_SAMPLES",
      "Captured samples do not look like the same face. Hold still, keep only your face in frame and try again."
    );
  }

  const descriptor = samples[0].map((_, i) => samples.reduce((sum, s) => sum + s[i], 0) / samples.length);
  return { descriptor, sampleCount: samples.length, maxSpread: Math.round(maxSpread * 1000) / 1000 };
};

export interface FaceMatchResult {
  matched: boolean;
  confidence: number;
  distance: number;
  reason: string;
}

export const compareWithEnrollment = (probe: number[], enrolled: number[]): FaceMatchResult => {
  const distance = euclideanDistance(probe, enrolled);
  const matched = distance <= FACE_CONFIG.matchThreshold;
  return {
    matched,
    confidence: distanceToConfidence(distance),
    distance: Math.round(distance * 1000) / 1000,
    reason: matched
      ? "Live face matches the enrolled face profile."
      : "Live face does not match the enrolled face profile.",
  };
};

// ------------------------------------------------------------------
// Embedding encryption at rest (AES-256-GCM)
// ------------------------------------------------------------------

const getEncryptionKey = (): Buffer => {
  const configured = process.env.FACE_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, "hex");
    if (key.length !== 32) {
      throw new Error("FACE_ENCRYPTION_KEY must be 64 hex characters (32 bytes).");
    }
    return key;
  }
  if (config.nodeEnv === "production") {
    throw new Error("FACE_ENCRYPTION_KEY is required in production.");
  }
  // Development fallback: derive a stable key from the JWT secret
  return crypto.createHash("sha256").update(`${config.jwtSecret}:face-embeddings`).digest();
};

export const encryptEmbedding = (descriptor: number[]): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const plaintext = Buffer.from(Float32Array.from(descriptor).buffer);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString("base64")).join(".");
};

export const decryptEmbedding = (payload: string): number[] => {
  const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  // Copy into a fresh, 4-byte aligned buffer before reinterpreting as float32
  return Array.from(new Float32Array(new Uint8Array(plaintext).buffer));
};
