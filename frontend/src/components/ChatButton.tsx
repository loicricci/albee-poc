"use client";

import { useChat } from "./ChatContext";

type ChatButtonProps = {
  handle: string;
  displayName?: string;
  className?: string;
  children?: React.ReactNode;
};

export function ChatButton({ handle, displayName, className, children }: ChatButtonProps) {
  const { openChat } = useChat();

  return (
    <button
      onClick={() => openChat(handle, displayName)}
      className={className}
    >
      {children || "Chat"}
    </button>
  );
}








