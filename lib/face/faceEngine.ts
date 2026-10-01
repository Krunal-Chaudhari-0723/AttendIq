"use client";

/**
 * Browser-side face engine built on @vladmandic/face-api (maintained face-api.js fork).
 *
 * - Detection:   TinyFaceDetector
 * - Landmarks:   68-point model (used for quality + liveness head-pose)
 * - Descriptor:  faceRecognitionNet, 128 numbers per face
 *
 * Only numeric descriptors / pose metrics leave the browser. Camera frames are never uploaded.
 * The server performs all identity matching.
 */

type FaceApi = typeof import("@vladmandic/face-api");

export const FACE_MODEL_VERSION = "face-api-1.7.15/faceRecognitionNet-128d";
const MODEL_URL = "/models/face-api";

let faceapiPromise: Promise<FaceApi> | null = null;

export const loadFaceEngine = (): Promise<FaceApi> => {
  if (!faceapiPromise) {
    faceapiPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      // The bundled tfjs exposes these at runtime, but face-api's type declarations omit them
      const tf = faceapi.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };
      const webgl = await tf.setBackend("webgl").catch(() => false);
      if (!webgl) await tf.setBackend("cpu");
      await tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return faceapi;
    })().catch((err) => {
      faceapiPromise = null; // allow retry
      throw err;
    });
  }
  return faceapiPromise;
};

export type FrameIssue = "NO_FACE" | "MULTIPLE_FACES" | "TOO_FAR" | "OFF_CENTER" | "TOO_DARK" | "TOO_BRIGHT" | "LOW_CONFIDENCE";

export interface FrameAnalysis {
  ok: boolean;
  issue?: FrameIssue;
  faceCount: number;
  score: number;
  /** Head yaw: ~0 facing camera, >0 turned to the user's LEFT, <0 turned to the user's RIGHT */
  yaw: number;
  brightness: number;
  faceWidthRatio: number;
  descriptor?: number[];
}

export const QUALITY = {
  minScore: 0.6,
  minFaceWidthRatio: 0.18,
  maxCenterOffset: 0.25,
  minBrightness: 45,
  maxBrightness: 225,
};

const brightnessCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;

/** Mean luminance (0-255) of a downscaled frame — a cheap "poor lighting" check. */
const measureBrightness = (video: HTMLVideoElement): number => {
  if (!brightnessCanvas) return 128;
  brightnessCanvas.width = 64;
  brightnessCanvas.height = 48;
  const ctx = brightnessCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 128;
  ctx.drawImage(video, 0, 0, 64, 48);
  const { data } = ctx.getImageData(0, 0, 64, 48);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return total / (data.length / 4);
};

/**
 * Yaw from 68-point landmarks: where the nose tip (30) sits between the jaw edges (0 and 16).
 * Raw camera frames are NOT mirrored, so when the user turns to their left the nose moves
 * towards the image's right edge and the ratio rises above 0.5.
 */
const computeYaw = (positions: { x: number; y: number }[]): number => {
  const left = positions[0].x;
  const right = positions[16].x;
  const nose = positions[30].x;
  const width = right - left;
  if (width <= 0) return 0;
  return (nose - left) / width - 0.5;
};

export const analyzeFrame = async (
  video: HTMLVideoElement,
  { withDescriptor = false }: { withDescriptor?: boolean } = {}
): Promise<FrameAnalysis> => {
  const faceapi = await loadFaceEngine();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 });
  const brightness = measureBrightness(video);
  const base: FrameAnalysis = { ok: false, faceCount: 0, score: 0, yaw: 0, brightness, faceWidthRatio: 0 };

  const detections = withDescriptor
    ? await faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors()
    : await faceapi.detectAllFaces(video, options).withFaceLandmarks();

  if (detections.length === 0) return { ...base, issue: brightness < QUALITY.minBrightness ? "TOO_DARK" : "NO_FACE" };
  if (detections.length > 1) return { ...base, faceCount: detections.length, issue: "MULTIPLE_FACES" };

  const det = detections[0];
  const box = det.detection.box;
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const faceWidthRatio = box.width / vw;
  const centerOffset = Math.max(Math.abs((box.x + box.width / 2) / vw - 0.5), Math.abs((box.y + box.height / 2) / vh - 0.5));
  const analysis: FrameAnalysis = {
    ...base,
    faceCount: 1,
    score: det.detection.score,
    yaw: computeYaw(det.landmarks.positions),
    faceWidthRatio,
    descriptor: "descriptor" in det ? Array.from((det as { descriptor: Float32Array }).descriptor) : undefined,
  };

  if (brightness < QUALITY.minBrightness) return { ...analysis, issue: "TOO_DARK" };
  if (brightness > QUALITY.maxBrightness) return { ...analysis, issue: "TOO_BRIGHT" };
  if (faceWidthRatio < QUALITY.minFaceWidthRatio) return { ...analysis, issue: "TOO_FAR" };
  if (centerOffset > QUALITY.maxCenterOffset) return { ...analysis, issue: "OFF_CENTER" };
  if (analysis.score < QUALITY.minScore) return { ...analysis, issue: "LOW_CONFIDENCE" };
  return { ...analysis, ok: true };
};

export const FRAME_ISSUE_MESSAGES: Record<FrameIssue, string> = {
  NO_FACE: "No face detected. Look straight at the camera.",
  MULTIPLE_FACES: "Multiple faces detected. Make sure only you are in the frame.",
  TOO_FAR: "Move closer to the camera.",
  OFF_CENTER: "Center your face inside the guide.",
  TOO_DARK: "Image is too dark. Move to a better-lit area.",
  TOO_BRIGHT: "Image is overexposed. Avoid strong light behind or in front of you.",
  LOW_CONFIDENCE: "Face is unclear. Hold still and remove anything covering your face.",
};
