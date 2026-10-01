"use client";

import { analyzeFrame } from "./faceEngine";
import { CaptureAborted, CaptureTimeout, FRONTAL_MAX_ABS_YAW } from "./capture";

export type LivenessChallenge = "TURN_LEFT" | "TURN_RIGHT";

export interface LivenessFrame {
  t: number;
  yaw: number;
  faces: number;
}

export type ChallengeStep = "CENTER" | "TURN" | "RETURN";

// Slightly stricter than the server thresholds (0.12 centre / 0.20 turn) so borderline frames don't fail there
const CENTER_YAW = FRONTAL_MAX_ABS_YAW - 0.02;
const TURN_YAW = 0.23;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class LivenessAbort extends Error {
  constructor(public code: "MULTIPLE_FACES" | "NO_FACE", message: string) {
    super(message);
  }
}

/**
 * Run the server-issued head-turn challenge on the live camera.
 * Records per-frame yaw (no images) and captures a descriptor at the peak of the turn.
 * The server re-evaluates everything; this only collects measurements.
 */
export async function runHeadTurnChallenge(
  video: HTMLVideoElement,
  challenge: LivenessChallenge,
  {
    onStep,
    signal,
    timeoutMs = 20_000,
  }: {
    onStep?: (step: ChallengeStep, yaw: number) => void;
    signal?: { cancelled: boolean };
    timeoutMs?: number;
  }
): Promise<{ frames: LivenessFrame[]; peakDescriptor: number[] }> {
  const direction = challenge === "TURN_LEFT" ? 1 : -1;
  const frames: LivenessFrame[] = [];
  const t0 = performance.now();
  const deadline = Date.now() + timeoutMs;
  let step: ChallengeStep = "CENTER";
  let centeredCount = 0;
  let missing = 0;
  let peakDescriptor: number[] | null = null;

  while (true) {
    if (signal?.cancelled) throw new CaptureAborted();
    if (Date.now() > deadline) {
      throw new CaptureTimeout(
        step === "TURN" ? "Head turn was not detected in time." : "Look back at the camera to finish the check."
      );
    }

    const wantDescriptor = step === "TURN" && !peakDescriptor;
    const frame = await analyzeFrame(video, { withDescriptor: wantDescriptor });

    if (frame.faceCount > 1) throw new LivenessAbort("MULTIPLE_FACES", "Multiple faces detected during the check.");
    if (frame.faceCount === 0) {
      if (++missing > 15) throw new LivenessAbort("NO_FACE", "Your face left the camera view.");
      await sleep(80);
      continue;
    }
    missing = 0;

    const signed = frame.yaw * direction;
    frames.push({ t: Math.round(performance.now() - t0), yaw: Math.round(frame.yaw * 1000) / 1000, faces: 1 });
    onStep?.(step, frame.yaw);

    if (step === "CENTER") {
      centeredCount = Math.abs(frame.yaw) <= CENTER_YAW ? centeredCount + 1 : 0;
      // The recording must begin facing the camera; drop off-centre lead-in frames
      if (centeredCount === 0) frames.length = 0;
      if (centeredCount >= 2) step = "TURN";
    } else if (step === "TURN") {
      if (signed >= TURN_YAW && frame.descriptor) {
        peakDescriptor = frame.descriptor;
        step = "RETURN";
        centeredCount = 0;
      }
    } else {
      centeredCount = Math.abs(frame.yaw) <= CENTER_YAW ? centeredCount + 1 : 0;
      if (centeredCount >= 2 && peakDescriptor) {
        return { frames, peakDescriptor };
      }
    }
    await sleep(90);
  }
}
