"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
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

  const emailTrim = useMemo(() => email.trim(), [email]);

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

    // If email confirmations are OFF, session exists => send user to app.
    if (data.session?.access_token) {
      setLoading(false);
      router.push("/app");
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6">
        <div className="mb-1 text-xs text-gray-500">AVEE</div>
        <h1 className="mb-4 text-xl font-semibold">Sign up</h1>

        {!successEmailConfirm ? (
          <form onSubmit={onSubmit}>
            <div className="mb-3">
              <label className="mb-1 block text-sm">Email</label>
              <input
                type="email"
                className="w-full rounded border px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm">Password</label>
              <input
                type="password"
                className="w-full rounded border px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <div className="mt-1 text-xs text-gray-500">
                Use at least 8 characters.
              </div>
            </div>

            {error && (
              <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {info && (
              <div className="mb-3 rounded bg-green-50 p-2 text-sm text-green-700">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-black px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create account"}
            </button>

            <button
              type="button"
              onClick={resendConfirmation}
              disabled={loading || !emailTrim || !signupAttempted}
              className="mt-3 w-full rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              title={!signupAttempted ? "Sign up first, then you can resend." : ""}
            >
              Resend confirmation email
            </button>

            <div className="mt-4 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="underline">
                Log in
              </Link>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded bg-green-50 p-3 text-sm text-green-700">
              Account created. Check your email to confirm, then log in.
            </div>

            {info && (
              <div className="rounded bg-green-50 p-2 text-sm text-green-700">
                {info}
              </div>
            )}

            {error && (
              <div className="rounded bg-red-50 p-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={resendConfirmation}
              disabled={loading || !emailTrim}
              className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Resend confirmation email
            </button>

            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center rounded bg-black px-3 py-2 text-sm text-white hover:bg-gray-800"
            >
              Go to login
            </Link>

            <div className="text-xs text-gray-500">
              Tip: check spam. Some providers delay confirmation emails.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

