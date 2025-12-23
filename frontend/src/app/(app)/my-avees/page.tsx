"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MyAveesRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect old /my-avees route to new /my-agents route
    router.replace("/my-agents");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-lg font-semibold">Redirecting...</div>
        <div className="text-sm text-gray-600">This page has moved to My Agents</div>
      </div>
    </div>
  );
}
