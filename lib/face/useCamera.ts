"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraError = "CAMERA_DENIED" | "CAMERA_UNAVAILABLE" | "CAMERA_IN_USE" | "INSECURE_CONTEXT";

export const CAMERA_ERROR_MESSAGES: Record<CameraError, string> = {
  CAMERA_DENIED:
    "Camera permission was denied. Allow camera access in your browser's site settings (lock icon in the address bar), then try again.",
  CAMERA_UNAVAILABLE: "No camera was found on this device. Connect a camera or use a device with a front camera.",
  CAMERA_IN_USE: "The camera is being used by another application. Close it and try again.",
  INSECURE_CONTEXT: "Camera access requires a secure connection (HTTPS or localhost).",
};

const mapCameraError = (err: unknown): CameraError => {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "CAMERA_DENIED";
  if (name === "NotReadableError" || name === "AbortError") return "CAMERA_IN_USE";
  return "CAMERA_UNAVAILABLE";
};

/** Owns a single front-camera MediaStream bound to a <video> element. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
  }, []);

  /** Returns null on success, otherwise the camera error (also stored in `error`). */
  const start = useCallback(async (): Promise<CameraError | null> => {
    setError(null);
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError("INSECURE_CONTEXT");
      return "INSECURE_CONTEXT";
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("CAMERA_UNAVAILABLE");
      return "CAMERA_UNAVAILABLE";
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        // Wait until real frame dimensions are known
        if (!video.videoWidth) {
          await new Promise<void>((resolve) => video.addEventListener("loadedmetadata", () => resolve(), { once: true }));
        }
      }
      setIsActive(true);
      return null;
    } catch (err) {
      stop();
      const code = mapCameraError(err);
      setError(code);
      return code;
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { videoRef, start, stop, isActive, error, setError };
}
