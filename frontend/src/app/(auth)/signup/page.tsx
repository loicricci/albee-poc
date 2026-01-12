"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAppConfig, type AppConfig } from "@/lib/config";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [successEmailConfirm, setSuccessEmailConfirm] = useState(false);
  const [signupAttempted, setSignupAttempted] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Start with empty config to avoid hydration mismatch
  const [appConfig, setAppConfig] = useState<AppConfig>({});

  const emailTrim = useMemo(() => email.trim(), [email]);

  useEffect(() => {
    // First, try to load from cache immediately
    const cached = localStorage.getItem('app_config');
    if (cached) {
      try {
        setAppConfig(JSON.parse(cached));
      } catch (e) {
        console.warn("Failed to parse cached config");
      }
    }

    // Then fetch fresh data from API
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
    setInfo(null);
    setSuccessEmailConfirm(false);
    setSignupAttempted(true);

    const pw = password;

    if (pw.length < 8) {
      setLoading(false);
      setError("Password must be at least 8 characters.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: emailTrim,
      password: pw,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Supabase may "succeed" even if the user already exists (anti-enumeration).
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setLoading(false);
      setInfo("This email already has an account. Please log in.");
      return;
    }

    // If email confirmations are OFF, session exists => send user to onboarding.
    if (data.session?.access_token) {
      setLoading(false);
      router.push("/onboarding");
      return;
    }

    // If confirmations are ON, no session, user must confirm email.
    setLoading(false);
    setSuccessEmailConfirm(true);
  }

  async function resendConfirmation() {
    setError(null);
    setInfo(null);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: emailTrim,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setInfo("Confirmation email resent. Check inbox and spam.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-[#f8fafc] to-white dark:from-[#0B0B0C] dark:via-[#0F0F10] dark:to-[#0B0B0C] px-4 py-12">
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
                  {appConfig.app_name || "AGENT"}
                </div>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#001f98] to-[#001670] shadow-lg dark:from-white dark:to-zinc-200" />
                <div className="text-2xl font-bold tracking-tight text-[#0B0B0C] dark:text-white">
                  {appConfig.app_name || "AGENT"}
                </div>
              </>
            )}
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-[#0B0B0C] dark:text-white">Create your account</h1>
          <p className="mt-2 text-[#001f98]/70 dark:text-zinc-400">Join {appConfig.app_name || "Avee"} and connect with AI personalities</p>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-white/[.08] bg-white dark:bg-zinc-950 p-8 shadow-xl">
          {!successEmailConfirm ? (
            <form onSubmit={onSubmit}>
              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C] dark:text-zinc-300">Email address</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-gray-200 dark:border-white/[.08] bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-[#0B0B0C] dark:text-white transition-all focus:border-[#001f98] dark:focus:border-white/[.20] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20 dark:focus:ring-white/[.10]"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-[#0B0B0C] dark:text-zinc-300">Password</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-gray-200 dark:border-white/[.08] bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-[#0B0B0C] dark:text-white transition-all focus:border-[#001f98] dark:focus:border-white/[.20] focus:outline-none focus:ring-2 focus:ring-[#001f98]/20 dark:focus:ring-white/[.10]"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <div className="mt-2 text-xs text-[#001f98]/60 dark:text-zinc-500">
                  Must be at least 8 characters long
                </div>
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

              {info && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
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
                  <div className="text-sm text-green-800">{info}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative mb-4 w-full overflow-hidden rounded-full bg-[#001f98] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#001670] hover:shadow-xl hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
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
                      Creating account…
                    </span>
                  ) : (
                    "Create account"
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={resendConfirmation}
                disabled={loading || !emailTrim || !signupAttempted}
                className="w-full rounded-full border-2 border-gray-200 dark:border-white/[.20] px-4 py-3 text-sm font-medium text-[#0B0B0C] dark:text-white transition-all hover:border-[#001f98] dark:hover:border-white/[.30] hover:bg-[#E6E6E6]/50 dark:hover:bg-white/[.08] disabled:cursor-not-allowed disabled:opacity-50"
                title={!signupAttempted ? "Sign up first, then you can resend." : ""}
              >
                Resend confirmation email
              </button>

              <div className="mt-6 text-center text-sm text-[#001f98]/70 dark:text-zinc-400">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-[#001f98] dark:text-white transition-colors hover:text-[#001670] dark:hover:text-zinc-300">
                  Log in
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <svg
                  className="h-6 w-6 shrink-0 text-green-600"
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
                <div>
                  <div className="font-semibold text-green-900">Account created successfully!</div>
                  <div className="mt-1 text-sm text-green-800">
                    Check your email to confirm, then log in.
                  </div>
                </div>
              </div>

              {info && (
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
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="text-sm text-green-800">{info}</div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
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
                type="button"
                onClick={resendConfirmation}
                disabled={loading || !emailTrim}
                className="w-full rounded-full border-2 border-gray-200 dark:border-white/[.20] px-4 py-3 text-sm font-medium text-[#0B0B0C] dark:text-white transition-all hover:border-[#001f98] dark:hover:border-white/[.30] hover:bg-[#E6E6E6]/50 dark:hover:bg-white/[.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Resend confirmation email
              </button>

              <Link
                href="/login"
                className="flex w-full items-center justify-center rounded-full bg-[#001f98] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#001670] hover:shadow-xl hover:scale-105 dark:bg-white dark:text-[#0B0B0C] dark:hover:bg-zinc-100"
              >
                Go to login
              </Link>

              <div className="rounded-lg bg-[#001f98]/5 dark:bg-white/[.03] border border-[#001f98]/10 dark:border-white/[.08] p-4 text-xs text-[#001f98] dark:text-zinc-400">
                <strong>Tip:</strong> Check your spam folder if you don't see the email. Some providers may delay confirmation emails.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
