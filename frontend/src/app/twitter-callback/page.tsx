"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function TwitterCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"connecting" | "success" | "error">("connecting");
  const [message, setMessage] = useState("Connecting to Twitter...");

  useEffect(() => {
    const handleCallback = async () => {
      // Get OAuth parameters from URL
      const oauth_token = searchParams.get("oauth_token");
      const oauth_verifier = searchParams.get("oauth_verifier");
      const denied = searchParams.get("denied");
      
      // Check if user denied authorization
      if (denied) {
        setStatus("error");
        setMessage("Twitter authorization was denied");
        setTimeout(() => {
          window.location.href = "/profile?twitter=denied";
        }, 2000);
        return;
      }

      // Check if we have the required parameters
      if (!oauth_token || !oauth_verifier) {
        setStatus("error");
        setMessage("Missing OAuth parameters");
        setTimeout(() => {
          window.location.href = "/profile?twitter=error";
        }, 2000);
        return;
      }

      try {
        // Get the state from session storage if available (for extra verification)
        const state = sessionStorage.getItem("twitter_oauth_state") || oauth_token;

        // Build callback URL to backend
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
        const callbackUrl = `${API_BASE}/twitter/oauth/callback?oauth_token=${oauth_token}&oauth_verifier=${oauth_verifier}&state=${state}`;

        // Clean up session storage
        sessionStorage.removeItem("twitter_oauth_state");

        // Follow the redirect (backend will redirect back to /profile)
        window.location.href = callbackUrl;
        
      } catch (err: any) {
        console.error("Twitter callback error:", err);
        setStatus("error");
        setMessage(err.message || "Failed to complete Twitter connection");
        setTimeout(() => {
          window.location.href = "/profile?twitter=error";
        }, 2000);
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#2E3A59] to-[#1a2332]">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-center">
          {status === "connecting" && (
            <>
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <svg
                  className="h-8 w-8 animate-spin text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <h1 className="mb-2 text-2xl font-bold text-[#0B0B0C]">
                Connecting Twitter
              </h1>
              <p className="text-sm text-[#2E3A59]/70">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="mb-2 text-2xl font-bold text-[#0B0B0C]">
                Connected!
              </h1>
              <p className="text-sm text-[#2E3A59]/70">{message}</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="mb-2 text-2xl font-bold text-[#0B0B0C]">
                Connection Failed
              </h1>
              <p className="text-sm text-[#2E3A59]/70">{message}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TwitterCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#2E3A59] to-[#1a2332]">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <TwitterCallbackContent />
    </Suspense>
  );
}

