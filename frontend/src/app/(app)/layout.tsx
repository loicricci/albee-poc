"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
  if (pathname === "/my-avees" || pathname.startsWith("/my-avees/")) return "My Avees";
  if (pathname === "/network" || pathname.startsWith("/network/")) return "Network";
  if (pathname.startsWith("/chat/")) return "Chat";
  return "App";
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const title = useMemo(() => pageTitle(pathname), [pathname]);

  useEffect(() => {
    let alive = true;

    async function syncSession() {
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

      if (!alive) return;

      if (!data.session) {
        setUserEmail(null);
        setReady(true); // ready so we can redirect cleanly
        router.push("/login");
        return;
      }

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
        router.push("/login");
        return;
      }

      setUserEmail(session.user?.email ?? null);
      setReady(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!ready) {
    return <div className="p-6 text-sm text-gray-600">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-6xl gap-6 p-6">
        {/* Sidebar */}
        <aside className="w-56 shrink-0">
          <Link
            href="/app"
            className="mb-4 flex items-center gap-2 rounded-md px-2 py-2 hover:bg-gray-100"
            title="Go to App"
          >
            <div className="h-8 w-8 rounded bg-black" />
            <div className="text-lg font-semibold">Avee</div>
          </Link>

          <nav className="space-y-1">
            <NavItem href="/app" label="App" />
            <NavItem href="/profile" label="Profile" />
            <NavItem href="/my-avees" label="My Avees" />
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
      </div>
    </div>
  );
}
