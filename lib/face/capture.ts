"use client";

import { analyzeFrame, FrameAnalysis, FRAME_ISSUE_MESSAGES } from "./faceEngine";

export const FRONTAL_MAX_ABS_YAW = 0.12;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class CaptureAborted extends Error {
  constructor() {
    super("Capture cancelled");
  }
}

export class CaptureTimeout extends Error {
  constructor(public lastIssue: string) {
    super(lastIssue);
  }
}

export const describeFrame = (frame: FrameAnalysis): string => {
  if (frame.issue) return FRAME_ISSUE_MESSAGES[frame.issue];
  if (Math.abs(frame.yaw) > FRONTAL_MAX_ABS_YAW) return "Look straight at the camera.";
  return "Hold still…";
};

/**
 * Wait for a stable, frontal, good-quality face, then capture `count` descriptors.
 * Every captured frame must itself pass the quality gate (single face, lit, centered, frontal).
 */
export async function captureFrontalDescriptors(
  video: HTMLVideoElement,
  {
    count,
    stableFrames = 4,
    timeoutMs = 25_000,
    onFrame,
    signal,
  }: {
    count: number;
    stableFrames?: number;
    timeoutMs?: number;
    onFrame?: (frame: FrameAnalysis, hint: string) => void;
    signal?: { cancelled: boolean };
  }
): Promise<number[][]> {
  const deadline = Date.now() + timeoutMs;
  let stable = 0;
  let lastHint = "No face detected. Look straight at the camera.";

  // 1. Wait for a stable frontal face
  while (stable < stableFrames) {
    if (signal?.cancelled) throw new CaptureAborted();
    if (Date.now() > deadline) throw new CaptureTimeout(lastHint);
    const frame = await analyzeFrame(video);
    const good = frame.ok && Math.abs(frame.yaw) <= FRONTAL_MAX_ABS_YAW;
    stable = good ? stable + 1 : 0;
    lastHint = describeFrame(frame);
    onFrame?.(frame, good ? "Hold still…" : lastHint);
    await sleep(120);
  }

  // 2. Capture descriptors a moment apart
  const descriptors: number[][] = [];
  while (descriptors.length < count) {
    if (signal?.cancelled) throw new CaptureAborted();
    if (Date.now() > deadline) throw new CaptureTimeout(lastHint);
    const frame = await analyzeFrame(video, { withDescriptor: true });
    if (frame.ok && Math.abs(frame.yaw) <= FRONTAL_MAX_ABS_YAW && frame.descriptor) {
      descriptors.push(frame.descriptor);
      onFrame?.(frame, `Capturing ${descriptors.length}/${count}…`);
    } else {
      lastHint = describeFrame(frame);
      onFrame?.(frame, lastHint);
    }
    await sleep(250);
  }
  return descriptors;
}
