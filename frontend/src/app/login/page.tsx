"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const signIn = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return setError(error.message);
    router.push("/app");
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-80 border rounded p-4 space-y-3">
        <h1 className="font-semibold text-lg">Login</h1>

        <input
          className="w-full border p-2 rounded"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          className="w-full border rounded p-2"
          onClick={signIn}
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
