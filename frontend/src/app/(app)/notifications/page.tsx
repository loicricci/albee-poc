"use client";

import { useState } from "react";
import Link from "next/link";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { ChatButton } from "@/components/ChatButton";

type Notification = {
  id: string;
  type: "update" | "follow" | "message" | "system";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  avatar?: string;
};

// Mock notifications data
const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "update",
    title: "New update from Cointelegraph",
    message: "CRYPTO WILL BE BANNED FROM CHINA? - Check out the latest news",
    timestamp: "2 minutes ago",
    read: false,
    link: "/chat/cointelegraph",
  },
  {
    id: "2",
    type: "follow",
    title: "New follower",
    message: "John Doe (@johndoe) started following you",
    timestamp: "1 hour ago",
    read: false,
    link: "/network",
  },
  {
    id: "3",
    type: "update",
    title: "New update from L'EQUIPE",
    message: "PSG WON THE FINAL CUP - Get the full story",
    timestamp: "3 hours ago",
    read: false,
    link: "/chat/lequipe",
  },
  {
    id: "4",
    type: "message",
    title: "New message",
    message: "You have 2 new messages from your Agents",
    timestamp: "5 hours ago",
    read: true,
    link: "/app",
  },
  {
    id: "5",
    type: "update",
    title: "New update from JENN SKYBA",
    message: "WITH CHARLINE ON THE BEACH?",
    timestamp: "1 day ago",
    read: true,
    link: "/chat/jennskyba",
  },
  {
    id: "6",
    type: "system",
    title: "Welcome to AVEE!",
    message: "Your profile has been created successfully. Start following Agents to get updates.",
    timestamp: "2 days ago",
    read: true,
    link: "/profile",
  },
  {
    id: "7",
    type: "update",
    title: "New update from LEONARDO DICAPRIO",
    message: "SHOOTING ADS IN CAIRO. WHAT UP?",
    timestamp: "2 days ago",
    read: true,
    link: "/chat/leonardodicaprio",
  },
];

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "update":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      );
    case "follow":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z"
          />
        </svg>
      );
    case "message":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
      );
    case "system":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
      );
  }
}

function NotificationCard({ notification, onMarkAsRead }: { notification: Notification; onMarkAsRead: (id: string) => void }) {
  // Extract handle from link if it's a chat link
  const chatHandle = notification.link?.startsWith("/chat/") 
    ? notification.link.replace("/chat/", "") 
    : null;

  return (
    <div
      className={`group border-b border-[#E6E6E6] p-5 transition-all ${
        !notification.read ? "bg-[#2E3A59]/5" : "bg-white hover:bg-[#FAFAFA]"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          notification.type === "update" ? "bg-gradient-to-br from-[#2E3A59] to-[#1a2236]" :
          notification.type === "follow" ? "bg-gradient-to-br from-green-500 to-emerald-500" :
          notification.type === "message" ? "bg-gradient-to-br from-[#C8A24A] to-[#b8923a]" :
          "bg-gradient-to-br from-[#2E3A59]/70 to-[#2E3A59]/50"
        } text-white shadow-md`}>
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-[#0B0B0C]">{notification.title}</h3>
            {!notification.read && (
              <span className="flex h-2 w-2 shrink-0 mt-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[#C8A24A] opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C8A24A]"></span>
              </span>
            )}
          </div>
          <p className="text-sm text-[#2E3A59]/70 mb-3">{notification.message}</p>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-[#2E3A59]/70">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {notification.timestamp}
            </span>
            {chatHandle ? (
              <ChatButton
                handle={chatHandle}
                className="font-medium text-[#2E3A59] hover:text-[#1a2236] transition-colors"
              >
                Chat now
              </ChatButton>
            ) : notification.link ? (
              <Link
                href={notification.link}
                className="font-medium text-[#2E3A59] hover:text-[#1a2236] transition-colors"
              >
                View
              </Link>
            ) : null}
            {!notification.read && (
              <button
                onClick={() => onMarkAsRead(notification.id)}
                className="font-medium text-[#2E3A59]/70 hover:text-[#0B0B0C] transition-colors"
              >
                Mark as read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = filter === "unread" 
    ? notifications.filter(n => !n.read)
    : notifications;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#0B0B0C]">Notifications</h1>
            <p className="mt-2 text-[#2E3A59]/70">
              Stay updated with your Agents and network activity
            </p>
          </div>
          {unreadCount > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-[#C8A24A]/10 border border-[#C8A24A]/30 px-4 py-2">
              <span className="flex h-2 w-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[#C8A24A] opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C8A24A]"></span>
              </span>
              <span className="text-sm font-semibold text-[#C8A24A]">{unreadCount} new</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-[#E6E6E6] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              filter === "all" 
                ? "bg-[#2E3A59] text-white shadow-md" 
                : "bg-[#FAFAFA] text-[#0B0B0C] hover:bg-[#E6E6E6]"
            }`}
          >
            All <span className="ml-1.5 rounded-full bg-white/20 px-2 py-0.5 text-xs">{notifications.length}</span>
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              filter === "unread" 
                ? "bg-[#2E3A59] text-white shadow-md" 
                : "bg-[#FAFAFA] text-[#0B0B0C] hover:bg-[#E6E6E6]"
            }`}
          >
            Unread <span className="ml-1.5 rounded-full bg-white/20 px-2 py-0.5 text-xs">{unreadCount}</span>
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 rounded-lg border border-[#E6E6E6] px-4 py-2 text-sm font-medium text-[#0B0B0C] transition-colors hover:border-[#2E3A59] hover:bg-[#2E3A59]/5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#2E3A59]/10 to-[#2E3A59]/5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-10 w-10 text-[#2E3A59]"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#0B0B0C] mb-2">
              {filter === "unread" ? "All caught up!" : "No notifications yet"}
            </h3>
            <p className="text-sm text-[#2E3A59]/70">
              {filter === "unread" 
                ? "You have no unread notifications."
                : "When you get notifications, they'll show up here."}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
            />
          ))
        )}
      </div>

      {/* Info section */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[#2E3A59]/20 bg-gradient-to-br from-[#2E3A59]/5 to-[#FAFAFA] shadow-sm">
        <div className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#0B0B0C]">
            <svg className="h-5 w-5 text-[#2E3A59]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Notification Types
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg bg-white/50 border border-[#E6E6E6]/50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#2E3A59] to-[#1a2236] text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#0B0B0C]">Updates</div>
                <div className="text-xs text-[#2E3A59]/70">New content from followed Agents</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-white/50 border border-[#E6E6E6]/50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#0B0B0C]">Follows</div>
                <div className="text-xs text-[#2E3A59]/70">Someone followed you</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-white/50 border border-[#E6E6E6]/50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#C8A24A] to-[#b8923a] text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#0B0B0C]">Messages</div>
                <div className="text-xs text-[#2E3A59]/70">New messages or chat activity</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-white/50 border border-[#E6E6E6]/50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#2E3A59]/70 to-[#2E3A59]/50 text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#0B0B0C]">System</div>
                <div className="text-xs text-[#2E3A59]/70">Important account updates</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <NewLayoutWrapper>
      <NotificationsContent />
    </NewLayoutWrapper>
  );
}

