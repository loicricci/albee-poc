"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChatProvider } from "@/components/ChatContext";
import dynamic from "next/dynamic";
import { AgentCacheProvider } from "@/components/AgentCache";
import { useAppData } from "@/contexts/AppDataContext";

// PERFORMANCE: Lazy load ChatModal (reduces initial bundle by ~50KB)
const ChatModalContainer = dynamic(() => import("@/components/ChatModal").then(mod => ({ default: mod.ChatModalContainer })), {
  ssr: false,
  loading: () => <div />, // Silent loading, modal appears when needed
});

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "block rounded-md px-3 py-2 text-sm",
        active ? "bg-black text-white" : "hover:bg-gray-100",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function pageTitle(pathname: string) {
  if (pathname === "/app" || pathname.startsWith("/app/")) return "App";
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return "Profile";
  if (pathname === "/account" || pathname.startsWith("/account/")) return "Profile"; // Redirect to profile
  if (pathname === "/agent" || pathname.startsWith("/agent/")) return "My Agent";
  if (pathname === "/my-agents" || pathname.startsWith("/my-agents/")) return "My Agents";
  if (pathname === "/network" || pathname.startsWith("/network/")) return "Network";
  if (pathname.startsWith("/chat/")) return "Chat";
  return "App";
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#f8fafc]">
      {/* Skeleton navigation bar */}
      <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          {/* Logo skeleton */}
          <div className="h-10 w-32 bg-[#e6eaff] rounded-lg animate-pulse" />
          
          {/* Navigation items skeleton */}
          <div className="flex gap-6">
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
          
          {/* User menu skeleton */}
          <div className="h-10 w-10 bg-[#e6eaff] rounded-full animate-pulse" />
        </div>
      </div>
      
      {/* Skeleton content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="space-y-6">
          {/* Title skeleton */}
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          
          {/* Composer skeleton */}
          <div className="h-32 bg-[#f8fafc] rounded-2xl border border-gray-200 animate-pulse" />
          
          {/* Feed items skeleton */}
          <div className="space-y-4">
            <div className="h-64 bg-[#f8fafc] rounded-2xl border border-gray-200 animate-pulse" />
            <div className="h-64 bg-[#f8fafc] rounded-2xl border border-gray-200 animate-pulse" />
            <div className="h-64 bg-[#f8fafc] rounded-2xl border border-gray-200 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Use AppDataContext for auth state - no redundant session checks!
  const { profile, isLoadingCritical } = useAppData();

  const title = useMemo(() => pageTitle(pathname), [pathname]);
  
  // Check if we're on pages that use the new layout - if so, render without the sidebar layout
  const usesNewLayout = pathname === "/app" || pathname === "/appv2" || pathname === "/onboarding" || pathname === "/profile" || pathname === "/account" || pathname === "/agent" || pathname === "/my-agents" || pathname === "/my-avees" || pathname === "/network" || pathname === "/notifications" || pathname === "/messages" || pathname === "/backoffice" || pathname.startsWith("/app/") || pathname.startsWith("/appv2/") || pathname.startsWith("/onboarding/") || pathname.startsWith("/profile/") || pathname.startsWith("/account/") || pathname.startsWith("/agent/") || pathname.startsWith("/my-agents/") || pathname.startsWith("/my-avees/") || pathname.startsWith("/network/") || pathname.startsWith("/notifications/") || pathname.startsWith("/messages/") || pathname.startsWith("/backoffice/") || pathname.startsWith("/u/") || pathname.startsWith("/feed");

  // Handle auth redirect in useEffect to avoid render-time side effects
  useEffect(() => {
    if (!isLoadingCritical && !profile && !pathname.startsWith("/onboarding")) {
      router.push("/login");
    }
  }, [isLoadingCritical, profile, pathname, router]);

  async function logout() {
    await supabase.auth.signOut();
    // Auth state change will be handled by AppDataContext
    router.push("/login");
  }

  // Show skeleton loading state while AppDataContext loads auth data
  if (isLoadingCritical) {
    return <LoadingSkeleton />;
  }

  // If not authenticated and not on onboarding, show skeleton while redirect happens
  if (!profile && !pathname.startsWith("/onboarding")) {
    return <LoadingSkeleton />;
  }

  // Get user email from profile (loaded by AppDataContext)
  const userEmail = profile?.user_id ? `${profile.handle}@app` : null;

  // If it uses the new layout, render without the sidebar layout
  if (usesNewLayout) {
    return (
      <AgentCacheProvider>
        <ChatProvider>
          {children}
          <ChatModalContainer />
        </ChatProvider>
      </AgentCacheProvider>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <AgentCacheProvider>
        <ChatProvider>
          <div className="mx-auto flex max-w-6xl gap-6 p-6">
        {/* Sidebar */}
        <aside className="w-56 shrink-0">
          <Link
            href="/app"
            className="mb-4 flex items-center gap-2 rounded-md px-2 py-2 hover:bg-gray-100"
            title="Go to App"
          >
            <div className="h-8 w-8 rounded bg-black" />
            <div className="text-lg font-semibold">Agent</div>
          </Link>

          <nav className="space-y-1">
            <NavItem href="/app" label="App" />
            <NavItem href="/profile" label="Profile" />
            <NavItem href="/my-agents" label="My Agents" />
            <NavItem href="/network" label="Network" />
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1">
          {/* Topbar */}
          <div className="mb-4 flex items-center justify-between rounded-lg border p-3">
            <div className="text-sm text-gray-600">
              {title}
              {userEmail ? (
                <span className="ml-3 text-xs text-gray-500">• {userEmail}</span>
              ) : null}
            </div>

            <button
              onClick={logout}
              className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
            >
              Logout
            </button>
          </div>

          <div className="rounded-lg border p-4">{children}</div>
        </main>
        <ChatModalContainer />
      </div>
      </ChatProvider>
      </AgentCacheProvider>
    </div>
  );
}
