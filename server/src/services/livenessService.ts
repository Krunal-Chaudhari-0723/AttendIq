import { LIVENESS_CONFIG } from "../config/verification";
import { LivenessChallenge } from "../models";

/**
 * Prototype liveness check: a random head-turn challenge issued by the server.
 *
 * The browser streams per-frame head-yaw measurements while the student follows the
 * instruction ("turn your head slightly LEFT, then look back"). The server checks that the
 * recorded motion actually matches the challenge it issued:
 *   1. starts facing the camera,
 *   2. turns past a threshold in the requested direction (not the other way),
 *   3. returns to facing the camera,
 *   4. with plausible timing and smooth motion, and exactly one face in every frame.
 *
 * This defeats static photos and pre-recorded clips (the direction is random per attempt).
 * It is NOT enterprise anti-spoofing: a person physically tilting a printed photo or a
 * real-time deepfake could still imitate the motion.
 */

export interface LivenessFrame {
  t: number; // ms since challenge start (client clock)
  yaw: number;
  faces: number;
}

export interface LivenessResult {
  passed: boolean;
  reason: string;
  peakYaw?: number;
  durationMs?: number;
}

const fail = (reason: string, extra: Partial<LivenessResult> = {}): LivenessResult => ({ passed: false, reason, ...extra });

export const parseFrames = (value: unknown): LivenessFrame[] | null => {
  if (!Array.isArray(value)) return null;
  if (value.length < LIVENESS_CONFIG.minFrames || value.length > LIVENESS_CONFIG.maxFrames) return null;
  const frames: LivenessFrame[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const { t, yaw, faces } = raw as Record<string, unknown>;
    const frame = { t: Number(t), yaw: Number(yaw), faces: Number(faces) };
    if (!Number.isFinite(frame.t) || !Number.isFinite(frame.yaw) || !Number.isInteger(frame.faces)) return null;
    if (Math.abs(frame.yaw) > 1) return null;
    frames.push(frame);
  }
  return frames;
};

export const evaluateLiveness = (
  challenge: LivenessChallenge,
  frames: LivenessFrame[],
  serverElapsedMs: number
): LivenessResult => {
  const cfg = LIVENESS_CONFIG;

  // Timing: strictly increasing timestamps, plausible duration, not longer than real elapsed time
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].t <= frames[i - 1].t) return fail("Liveness frames are out of order.");
  }
  const durationMs = frames[frames.length - 1].t - frames[0].t;
  if (durationMs < cfg.minDurationMs) return fail("Head movement was too fast to be verified.", { durationMs });
  if (durationMs > cfg.maxDurationMs) return fail("Head movement took too long. Please try again.", { durationMs });
  if (durationMs > serverElapsedMs + 1000) return fail("Liveness timing is inconsistent.", { durationMs });

  // Exactly one face throughout
  if (frames.some((f) => f.faces !== 1)) return fail("Exactly one face must stay in view during the check.");

  // Smooth motion: a sudden jump suggests a swapped image rather than a turning head
  for (let i = 1; i < frames.length; i++) {
    if (Math.abs(frames[i].yaw - frames[i - 1].yaw) > 0.35) return fail("Head movement was not continuous.");
  }

  const direction = challenge === "TURN_LEFT" ? 1 : -1;
  const signed = frames.map((f) => f.yaw * direction); // > 0 means "towards the requested side"

  // 1. Start facing the camera
  const startFrames = signed.slice(0, 2);
  if (startFrames.some((y) => Math.abs(y) > cfg.centerMaxAbsYaw)) {
    return fail("Start the check while looking straight at the camera.");
  }

  // 2. Reach the turn threshold in the requested direction
  const peakIndex = signed.findIndex((y) => y >= cfg.turnMinAbsYaw);
  if (peakIndex === -1) {
    const wrongWay = signed.some((y) => y <= -cfg.turnMinAbsYaw);
    return fail(wrongWay ? "You turned the wrong way." : "Head turn was not detected. Turn a little further.");
  }
  if (signed.slice(0, peakIndex).some((y) => y <= -cfg.turnMinAbsYaw)) {
    return fail("You turned the wrong way first.");
  }
  const peakYaw = Math.max(...signed) * direction;

  // 3. Return to facing the camera after the turn
  const afterPeak = signed.slice(peakIndex + 1);
  const endFrames = signed.slice(-2);
  if (afterPeak.length < 2 || endFrames.some((y) => Math.abs(y) > cfg.centerMaxAbsYaw)) {
    return fail("Look back at the camera after turning your head.", { peakYaw, durationMs });
  }

  return { passed: true, reason: "Head-turn challenge completed.", peakYaw: Math.round(peakYaw * 1000) / 1000, durationMs };
};
