"use client";

import { useChat } from "./ChatContext";

/**
 * Floating Avee helper button that appears on all authenticated pages.
 * Opens a chat with the "avee" agent when clicked.
 */
export function AveeHelperButton() {
  const { openChat } = useChat();

  const handleClick = () => {
    openChat("avee", "Avee Assistant");
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-4 right-20 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-[#001f98]"
      style={{
        background: "linear-gradient(135deg, #001f98 0%, #001670 100%)",
      }}
      title="Ask Avee"
      aria-label="Open Avee Assistant chat"
    >
      {/* Chat bubble icon with "A" for Avee */}
      <svg
        className="h-6 w-6 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    </button>
  );
}
