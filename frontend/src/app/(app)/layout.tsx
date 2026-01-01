"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChatProvider } from "@/components/ChatContext";
import dynamic from "next/dynamic";
import { AgentCacheProvider } from "@/components/AgentCache";

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'layout.tsx:39',message:'AppLayout rendering',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const title = useMemo(() => pageTitle(pathname), [pathname]);
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'layout.tsx:52',message:'Layout path check',data:{pathname:pathname,usesNewLayout:pathname === "/app" || pathname === "/onboarding" || pathname === "/profile" || pathname === "/account" || pathname === "/agent" || pathname === "/my-agents" || pathname === "/my-avees" || pathname === "/network" || pathname === "/notifications" || pathname === "/messages" || pathname === "/backoffice" || pathname.startsWith("/app/") || pathname.startsWith("/onboarding/") || pathname.startsWith("/profile/") || pathname.startsWith("/account/") || pathname.startsWith("/agent/") || pathname.startsWith("/my-agents/") || pathname.startsWith("/my-avees/") || pathname.startsWith("/network/") || pathname.startsWith("/notifications/") || pathname.startsWith("/messages/") || pathname.startsWith("/backoffice/") || pathname.startsWith("/u/") || pathname.startsWith("/feed")},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  // Check if we're on pages that use the new layout - if so, render without the sidebar layout
  const usesNewLayout = pathname === "/app" || pathname === "/onboarding" || pathname === "/profile" || pathname === "/account" || pathname === "/agent" || pathname === "/my-agents" || pathname === "/my-avees" || pathname === "/network" || pathname === "/notifications" || pathname === "/messages" || pathname === "/backoffice" || pathname.startsWith("/app/") || pathname.startsWith("/onboarding/") || pathname.startsWith("/profile/") || pathname.startsWith("/account/") || pathname.startsWith("/agent/") || pathname.startsWith("/my-agents/") || pathname.startsWith("/my-avees/") || pathname.startsWith("/network/") || pathname.startsWith("/notifications/") || pathname.startsWith("/messages/") || pathname.startsWith("/backoffice/") || pathname.startsWith("/u/") || pathname.startsWith("/feed");

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'layout.tsx:51',message:'Layout useEffect triggered',data:{pathname:pathname,actualURL:typeof window !== 'undefined' ? window.location.href : 'SSR'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F,G,H'})}).catch(()=>{});
    // #endregion
    let alive = true;

    async function syncSession() {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'layout.tsx:58',message:'syncSession started',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      const { data, error } = await supabase.auth.getSession();

      // Debug (remove later)
      // eslint-disable-next-line no-console
      console.log("getSession error:", error);
      // eslint-disable-next-line no-console
      console.log("session exists:", !!data.session);
      // eslint-disable-next-line no-console
      console.log("email:", data.session?.user?.email);
      // eslint-disable-next-line no-console
      console.log("token prefix:", data.session?.access_token?.slice(0, 20));

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'layout.tsx:76',message:'After getSession',data:{hasError:!!error,hasSession:!!data.session,email:data.session?.user?.email},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'})}).catch(()=>{});
      // #endregion

      if (!alive) return;

      if (!data.session) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'layout.tsx:84',message:'No session - will redirect to login',data:{pathname:pathname,willRedirect:!pathname.startsWith("/onboarding")},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        setUserEmail(null);
        setReady(true); // ready so we can redirect cleanly
        // Don't redirect to login if we're on onboarding - let onboarding page handle it
        if (!pathname.startsWith("/onboarding")) {
          router.push("/login");
        }
        return;
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'layout.tsx:97',message:'Session valid - setting ready',data:{email:data.session.user?.email},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      setUserEmail(data.session.user?.email ?? null);
      setReady(true);
    }

    // Initial sync
    syncSession();

    // Listen to login/logout changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Debug (remove later)
      // eslint-disable-next-line no-console
      console.log("auth event:", _event, "session:", !!session);

      if (!alive) return;

      if (!session) {
        setUserEmail(null);
        setReady(true);
        // Don't redirect to login if we're on onboarding
        if (!pathname.startsWith("/onboarding")) {
          router.push("/login");
        }
        return;
      }

      setUserEmail(session.user?.email ?? null);
      setReady(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router, pathname]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!ready) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'layout.tsx:133',message:'Layout not ready - showing loading',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    return <div className="p-6 text-sm text-gray-600">Loading…</div>;
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'layout.tsx:141',message:'Layout ready - checking usesNewLayout',data:{usesNewLayout:usesNewLayout,pathname:pathname},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
  // #endregion

  // If it uses the new layout, render without the sidebar layout
  if (usesNewLayout) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e3b88ece-ecd1-4046-9aab-ee22bba05a0c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'layout.tsx:148',message:'Rendering with new layout (no sidebar)',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
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
