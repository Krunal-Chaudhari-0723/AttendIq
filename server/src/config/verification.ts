/**
 * Central, explicit thresholds for every verification layer.
 * Keeping them in one file makes the security model easy to audit and tune.
 */
const num = (value: string | undefined, fallback: number) => {
  const parsed = value !== undefined ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const FACE_CONFIG = {
  // face-api.js faceRecognitionNet produces 128-dimensional descriptors
  descriptorLength: 128,
  modelVersion: "face-api-1.7.15/faceRecognitionNet-128d",
  // Euclidean distance at or below which two descriptors are treated as the same person.
  // face-api.js documents 0.6 as a general default; we are deliberately stricter.
  // Calibration on 21 different people (210 impostor pairs): closest pair was 0.511 apart,
  // 0.55 would have falsely accepted 5 pairs, 0.50 accepted none.
  matchThreshold: num(process.env.FACE_MATCH_THRESHOLD, 0.5),
  // Enrollment samples captured seconds apart must agree with each other at least this well
  enrollmentConsistencyThreshold: 0.45,
  minEnrollmentSamples: 1,
  maxEnrollmentSamples: 5,
};

export const LIVENESS_CONFIG = {
  // Yaw ratio: horizontal nose-tip position between the jaw edges (landmarks 0 and 16), centred on 0.
  // ~0 when facing the camera, positive/negative when the head turns.
  centerMaxAbsYaw: 0.12,
  turnMinAbsYaw: 0.2,
  minFrames: 6,
  maxFrames: 200,
  minDurationMs: 800,
  maxDurationMs: 30_000,
  // The two frontal descriptors captured before and after the challenge must be the same person
  startEndMaxDistance: 0.45,
  // The descriptor captured mid-turn must still resemble the enrolled face (looser: pose changes it)
  peakMaxDistance: num(process.env.FACE_PEAK_MAX_DISTANCE, 0.6),
};

export const ATTENDANCE_CONFIG = {
  // A verification attempt (location -> face -> liveness) must finish within this window
  attemptTtlMs: 3 * 60 * 1000,
  // Attempts (audit trail) are purged automatically after this many days
  attemptRetentionDays: 30,
  defaultSessionMinutes: 60,
  minSessionMinutes: 5,
  maxSessionMinutes: 240,
  // Students verifying after this many minutes from session start are marked LATE
  defaultLateAfterMinutes: 15,
};
