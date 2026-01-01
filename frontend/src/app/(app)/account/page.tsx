"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the profile page which now handles all account settings
    router.replace('/profile');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#2E3A59] border-r-transparent"></div>
        <p className="mt-4 text-sm text-[#2E3A59]/70">Redirecting to profile settings...</p>
      </div>
    </div>
  );
}

