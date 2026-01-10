"use client";

import { useState, useRef, useEffect } from "react";

type VoiceRecorderProps = {
  onRecordingComplete: (audioBlob: Blob) => void;
  maxDuration?: number; // in seconds
  className?: string;
};

export function VoiceRecorder({
  onRecordingComplete,
  maxDuration = 30,
  className = "",
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        onRecordingComplete(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return newTime;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to access microphone");
      console.error("Recording error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={className}>
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div className="font-medium">Microphone Access Required</div>
              <div className="mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            Start Recording
          </button>
        ) : (
          <>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg animate-pulse"
            >
              <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
              Stop Recording
            </button>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span className="font-mono font-semibold">{formatTime(recordingTime)}</span>
              <span className="text-gray-400">/ {formatTime(maxDuration)}</span>
            </div>
          </>
        )}
      </div>

      {isRecording && (
        <div className="mt-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="h-1 w-1 animate-ping rounded-full bg-red-500" />
              <div className="h-1 w-1 animate-ping rounded-full bg-red-500" style={{ animationDelay: "0.2s" }} />
              <div className="h-1 w-1 animate-ping rounded-full bg-red-500" style={{ animationDelay: "0.4s" }} />
            </div>
            <span>Recording in progress... Speak naturally about yourself</span>
          </div>
        </div>
      )}
    </div>
  );
}













