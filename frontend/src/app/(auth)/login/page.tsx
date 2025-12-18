"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
  
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
  
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
  
    // 🔍 DEBUG: check if session exists
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
  
    console.log("LOGIN SESSION ERROR:", sessionError);
    console.log("LOGIN SESSION:", sessionData.session);
  
    setLoading(false);
  
    // Success → go to app
    router.push("/app");
  }
  

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border bg-white p-6"
      >
        <h1 className="mb-4 text-xl font-semibold">Login</h1>

        <div className="mb-3">
          <label className="mb-1 block text-sm">Email</label>
          <input
            type="email"
            className="w-full rounded border px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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
          />
        </div>

        {error && (
          <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div className="mt-4 text-center text-sm text-gray-600">
          No account?{" "}
          <a href="/signup" className="underline">
            Sign up
          </a>
        </div>
      </form>
    </div>
  );
}
