"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function AveeHandleRedirect() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    // Redirect old /my-avees/[handle] route to new /my-agents/[handle] route
    const handle = params?.handle;
    if (handle) {
      router.replace(`/my-agents/${handle}`);
    } else {
      router.replace("/my-agents");
    }
  }, [router, params]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-lg font-semibold">Redirecting...</div>
        <div className="text-sm text-gray-600">This page has moved to My Agents</div>
      </div>
    </div>
  );
}
