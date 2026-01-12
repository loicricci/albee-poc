"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";

/**
 * Redirect page for /agent -> /my-agents
 * 
 * This page was previously a simplified agent editor for non-admin users.
 * All users now have access to the full-featured agent editor at /my-agents.
 * Non-admin users are automatically redirected to their specific agent's page.
 */
export default function AgentPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the full-featured agent editor
    router.replace("/my-agents");
  }, [router]);

  // Show a brief loading state while redirecting
  return (
    <NewLayoutWrapper>
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-[#001f98]">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium">Redirecting to Agent Editor...</span>
        </div>
      </div>
    </NewLayoutWrapper>
  );
}
