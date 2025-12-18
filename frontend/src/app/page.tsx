import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      {/* Top bar */}
      <header className="border-b border-black/[.08] dark:border-white/[.12]">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-black dark:bg-white" />
            <div className="font-semibold text-black dark:text-zinc-50">AVEE</div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="h-10 px-4 inline-flex items-center justify-center rounded-full border border-black/[.12] text-sm text-black hover:bg-black/[.04]
                         dark:border-white/[.16] dark:text-zinc-50 dark:hover:bg-white/[.08]"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="h-10 px-4 inline-flex items-center justify-center rounded-full bg-black text-sm text-white hover:bg-[#383838]
                         dark:bg-white dark:text-black dark:hover:bg-[#ccc]"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          {/* Left */}
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/[.08] px-3 py-1 text-xs text-zinc-600
                            dark:border-white/[.12] dark:text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-zinc-400" />
              MVP • layered access • server-side enforcement
            </div>

            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
              Avee is your AI persona.
              <br />
              You control what it knows.
            </h1>

            <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Create an Avee. Train it with your own text. Set permissions.
              People can chat with the version they’re allowed to access:
              public, friends, or intimate.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="h-12 px-5 inline-flex items-center justify-center rounded-full bg-black text-white text-sm font-medium
                           hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#ccc]"
              >
                Create your Avee
              </Link>

              <Link
                href="/login"
                className="h-12 px-5 inline-flex items-center justify-center rounded-full border border-black/[.12] text-black text-sm font-medium
                           hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-50 dark:hover:bg-white/[.08]"
              >
                I already have an account
              </Link>
            </div>
          </div>

          {/* Right */}
          <div className="border border-black/[.08] dark:border-white/[.12] rounded-2xl bg-white dark:bg-black p-6">
            <div className="text-sm font-medium text-black dark:text-zinc-50">How it works</div>

            <ol className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400 list-decimal ml-5">
              <li>Sign up and create your profile.</li>
              <li>Create an Avee.</li>
              <li>Add training text by layer (public / friends / intimate).</li>
              <li>Grant access to specific people.</li>
              <li>Chat. Context is filtered server-side by permissions.</li>
            </ol>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-black/[.08] dark:border-white/[.12] p-4">
                <div className="text-sm font-medium text-black dark:text-zinc-50">Layers</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Separate knowledge by access level.
                </div>
              </div>
              <div className="rounded-xl border border-black/[.08] dark:border-white/[.12] p-4">
                <div className="text-sm font-medium text-black dark:text-zinc-50">Permissions</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Viewer → max layer.
                </div>
              </div>
              <div className="rounded-xl border border-black/[.08] dark:border-white/[.12] p-4">
                <div className="text-sm font-medium text-black dark:text-zinc-50">Chat</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Talk to Avees you follow.
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between text-xs text-zinc-500">
              <div>© {new Date().getFullYear()} AVEE</div>
              <div className="flex items-center gap-2">
                <Image
                  className="dark:invert"
                  src="/next.svg"
                  alt="Next.js"
                  width={60}
                  height={14}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

