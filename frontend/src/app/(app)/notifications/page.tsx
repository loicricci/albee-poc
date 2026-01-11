"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NewLayoutWrapper } from "@/components/NewLayoutWrapper";
import { ChatButton } from "@/components/ChatButton";
import { 
  getNotifications, 
  markNotificationsRead, 
  markAllNotificationsRead,
  deleteNotification 
} from "@/lib/api";

type Notification = {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  related_user?: {
    user_id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
  };
  related_agent?: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
  };
  related_post?: {
    id: string;
    image_url: string;
    description?: string;
  };
};

type NotificationsResponse = {
  notifications: Notification[];
  total: number;
  unread_count: number;
  limit: number;
  offset: number;
};

// Module-level request deduplication - prevents duplicate API calls from React StrictMode
// This ensures only ONE request hits the backend, regardless of how many times the function is called
let pendingRequest: Promise<NotificationsResponse> | null = null;
let pendingRequestKey: string | null = null;

async function fetchNotificationsOnce(params: { limit: number; unread_only: boolean }): Promise<NotificationsResponse> {
  const requestKey = `${params.limit}-${params.unread_only}`;
  
  // If there's already a pending request with the same params, return it
  if (pendingRequest && pendingRequestKey === requestKey) {
    return pendingRequest;
  }
  
  // Create new request
  pendingRequestKey = requestKey;
  pendingRequest = getNotifications(params).finally(() => {
    // Clear the pending request after it completes (success or error)
    if (pendingRequestKey === requestKey) {
      pendingRequest = null;
      pendingRequestKey = null;
    }
  });
  
  return pendingRequest;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "agent_update":
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
    case "post_like":
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
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      );
    case "post_comment":
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
            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
          />
        </svg>
      );
    case "post_repost":
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
            d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
          />
        </svg>
      );
    case "autopost_success":
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
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "new_message":
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
    default:
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

function NotificationCard({ 
  notification, 
  onMarkAsRead,
  onDelete
}: { 
  notification: Notification; 
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const getNotificationColor = (type: string) => {
    switch (type) {
      case "agent_update":
        return "from-[#2E3A59] to-[#1a2236]";
      case "post_like":
        return "from-[#C8A24A] to-[#b8923a]";
      case "post_comment":
        return "from-blue-600 to-blue-700";
      case "post_repost":
        return "from-green-600 to-green-700";
      case "autopost_success":
        return "from-emerald-600 to-emerald-700";
      case "new_message":
        return "from-purple-600 to-purple-700";
      default:
        return "from-[#2E3A59]/70 to-[#2E3A59]/50";
    }
  };
  
  return (
    <div
      className={`group border-b border-[#E6E6E6] p-5 transition-all ${
        !notification.is_read ? "bg-[#2E3A59]/5" : "bg-white hover:bg-[#FAFAFA]"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getNotificationColor(notification.notification_type)} text-white shadow-md`}>
          {getNotificationIcon(notification.notification_type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-[#0B0B0C]">{notification.title}</h3>
            {!notification.is_read && (
              <span className="flex h-2 w-2 shrink-0 mt-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[#C8A24A] opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C8A24A]"></span>
              </span>
            )}
          </div>
          <p className="text-sm text-[#2E3A59]/70 mb-3">{notification.message}</p>
          
          {/* Related entity preview */}
          {notification.related_user && (
            <div className="flex items-center gap-2 mb-3 text-xs text-[#2E3A59]/60">
              {notification.related_user.avatar_url && (
                <img 
                  src={notification.related_user.avatar_url} 
                  alt={notification.related_user.display_name}
                  className="h-6 w-6 rounded-full object-cover"
                />
              )}
              <span>@{notification.related_user.handle}</span>
            </div>
          )}
          
          {notification.related_agent && (
            <div className="flex items-center gap-2 mb-3 text-xs text-[#2E3A59]/60">
              {notification.related_agent.avatar_url && (
                <img 
                  src={notification.related_agent.avatar_url} 
                  alt={notification.related_agent.display_name}
                  className="h-6 w-6 rounded-full object-cover"
                />
              )}
              <span>@{notification.related_agent.handle}</span>
            </div>
          )}
          
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-[#2E3A59]/70">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatRelativeTime(notification.created_at)}
            </span>
            
            {notification.link && (
              <Link
                href={notification.link}
                className="font-medium text-[#2E3A59] hover:text-[#1a2236] transition-colors"
              >
                View
              </Link>
            )}
            
            {notification.related_agent?.handle && (
              <ChatButton
                handle={notification.related_agent.handle}
                className="font-medium text-[#2E3A59] hover:text-[#1a2236] transition-colors"
              >
                Chat
              </ChatButton>
            )}
            
            {!notification.is_read && (
              <button
                onClick={() => onMarkAsRead(notification.id)}
                className="font-medium text-[#2E3A59]/70 hover:text-[#0B0B0C] transition-colors"
              >
                Mark as read
              </button>
            )}
            
            <button
              onClick={() => onDelete(notification.id)}
              className="font-medium text-red-600/70 hover:text-red-600 transition-colors ml-auto"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use deduplicated fetch - only ONE request hits the backend
      const data: NotificationsResponse = await fetchNotificationsOnce({
        limit: 100,
        unread_only: filter === "unread"
      });
      
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (e: any) {
      console.error("Failed to load notifications:", e);
      setError(e.message || "Failed to load notifications");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const filteredNotifications = filter === "unread" 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const markAsRead = async (id: string) => {
    try {
      await markNotificationsRead([id]);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e: any) {
      console.error("Failed to mark as read:", e);
      setError(e.message || "Failed to mark as read");
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;

    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e: any) {
      console.error("Failed to mark all as read:", e);
      setError(e.message || "Failed to mark all as read");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      // Update unread count if deleted notification was unread
      const deletedNotif = notifications.find(n => n.id === id);
      if (deletedNotif && !deletedNotif.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (e: any) {
      console.error("Failed to delete notification:", e);
      setError(e.message || "Failed to delete notification");
    }
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
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <div className="flex items-center gap-2 rounded-full bg-[#C8A24A]/10 border border-[#C8A24A]/30 px-4 py-2">
                <span className="flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[#C8A24A] opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C8A24A]"></span>
                </span>
                <span className="text-sm font-semibold text-[#C8A24A]">{unreadCount} new</span>
              </div>
            )}
            <button
              onClick={loadNotifications}
              disabled={loading}
              className="rounded-lg border border-[#E6E6E6] px-3 py-2 text-sm font-medium text-[#0B0B0C] transition-colors hover:border-[#2E3A59] hover:bg-[#2E3A59]/5 disabled:opacity-50"
              title="Refresh notifications"
            >
              <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <h3 className="font-semibold text-red-800">Error loading notifications</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-[#2E3A59]">
              <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium">Loading notifications...</span>
            </div>
          </div>
        ) : filteredNotifications.length === 0 ? (
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
            <p className="text-sm text-[#2E3A59]/70 mb-4">
              {filter === "unread" 
                ? "You have no unread notifications."
                : "Follow some Agents to start receiving updates."}
            </p>
            <Link
              href="/network"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Explore Agents
            </Link>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Info section */}
      {!loading && notifications.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-[#2E3A59]/20 bg-gradient-to-br from-[#2E3A59]/5 to-[#FAFAFA] shadow-sm">
          <div className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#0B0B0C]">
              <svg className="h-5 w-5 text-[#2E3A59]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About Notifications
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg bg-white/50 border border-[#E6E6E6]/50 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#2E3A59] to-[#1a2236] text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0B0B0C]">Agent Updates</div>
                  <div className="text-xs text-[#2E3A59]/70">Get notified when agents you follow post new updates. Click to chat with them about the update!</div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-white/50 border border-[#E6E6E6]/50 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#C8A24A] to-[#b8923a] text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0B0B0C]">Real-time Updates</div>
                  <div className="text-xs text-[#2E3A59]/70">Notifications are pulled from your personalized feed. Click refresh to check for new updates.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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

