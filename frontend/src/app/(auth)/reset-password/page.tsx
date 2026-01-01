"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getAppConfig, type AppConfig } from "@/lib/config";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig>({});

  useEffect(() => {
    // Load app config from cache
    const cached = localStorage.getItem('app_config');
    if (cached) {
      try {
        setAppConfig(JSON.parse(cached));
      } catch (e) {
        console.warn("Failed to parse cached config");
      }
    }

    // Fetch fresh config
    getAppConfig()
      .then((config) => {
        setAppConfig(config);
        localStorage.setItem('app_config', JSON.stringify(config));
      })
      .catch((error) => {
        console.warn("App config not available:", error);
        const defaultConfig = { app_name: "Avee" };
        setAppConfig(defaultConfig);
        localStorage.setItem('app_config', JSON.stringify(defaultConfig));
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-[#FAFAFA] to-white dark:from-[#0B0B0C] dark:via-[#0F0F10] dark:to-[#0B0B0C] px-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-3 transition-all duration-300 hover:opacity-70">
            {appConfig.app_logo_url && appConfig.app_logo_url.trim() !== "" ? (
              <>
                <img 
                  src={appConfig.app_logo_url} 
                  alt={appConfig.app_name || "Logo"}
                  className="h-16 w-auto object-contain"
                  loading="eager"
                  onError={(e) => {
                    console.error("Failed to load logo");
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="text-2xl font-bold tracking-tight text-[#0B0B0C] dark:text-white">
                  AVEE
                </div>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#2E3A59] to-[#1a2236] shadow-lg dark:from-white dark:to-zinc-200" />
                <div className="text-2xl font-bold tracking-tight text-[#0B0B0C] dark:text-white">
                  {appConfig.app_name || "Avee"}
                </div>
              </>
            )}
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-[#0B0B0C] dark:text-white">Reset your password</h1>
          <p className="mt-2 text-[#2E3A59]/70 dark:text-zinc-400">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/[.08] bg-white dark:bg-zinc-950 p-8 shadow-xl">
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <svg
                className="h-5 w-5 shrink-0 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-green-800">Check your email</h3>
                <p className="mt-1 text-sm text-green-700">
                  We've sent a password reset link to <strong>{email}</strong>. 
                  Click the link in the email to reset your password.
                </p>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="font-semibold text-[#2E3A59] dark:text-white transition-colors hover:text-[#1a2236] dark:hover:text-zinc-300"
              >
                ← Back to login
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-[#E6E6E6] dark:border-white/[.08] bg-white dark:bg-zinc-950 p-8 shadow-xl"
          >
            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-[#0B0B0C] dark:text-zinc-300">Email address</label>
              <input
                type="email"
                className="w-full rounded-lg border border-[#E6E6E6] dark:border-white/[.08] bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-[#0B0B0C] dark:text-white transition-all focus:border-[#2E3A59] dark:focus:border-white/[.20] focus:outline-none focus:ring-2 focus:ring-[#2E3A59]/20 dark:focus:ring-white/[.10]"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <svg
                  className="h-5 w-5 shrink-0 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-full bg-[#2E3A59] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#1a2236] hover:shadow-xl hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
            >
              <span className="relative z-10">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  "Send reset link"
                )}
              </span>
            </button>

            <div className="mt-6 text-center text-sm text-[#2E3A59]/70 dark:text-zinc-400">
              Remember your password?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#2E3A59] dark:text-white transition-colors hover:text-[#1a2236] dark:hover:text-zinc-300"
              >
                Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


