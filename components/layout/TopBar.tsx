"use client";

import React from "react";
import { Bell, Settings, Search, Wifi, WifiOff } from "lucide-react";
import { useNavigationStore } from "@/store/navigationStore";
import { IKFBadge } from "@/components/ui/IKFBadge";
import { useSocket } from "@/components/providers/SocketProvider";
import { useRouter } from "next/navigation";

import { useTournamentStore } from "@/store/tournamentStore";

export function Topbar() {
  const { activePage } = useNavigationStore();
  const { isConnected } = useSocket();
  const { notifications, markNotificationsRead } = useTournamentStore();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const router = useRouter();

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="h-[64px] bg-[var(--bg-secondary)]/95 backdrop-blur-md border-b border-[var(--border-default)] z-40 flex items-center justify-between px-6 flex-shrink-0">
      {/* ── Left: Current Page Title ── */}
      <div className="flex items-center">
        <h2 className="font-display text-2xl text-[var(--text-primary)] tracking-wide">
          {activePage}
        </h2>
      </div>

      {/* ── Center: Tournament Name ── */}
      <div className="absolute left-1/2 -translate-x-1/2 items-center gap-3 hidden md:flex">
        <span className="font-display text-xl text-[var(--ikf-gold)] tracking-widest drop-shadow-[0_0_8px_rgba(212,160,23,0.3)]">
          IKF WORLD CHAMPIONSHIP 2026
        </span>
        <IKFBadge variant="live" size="sm" />
      </div>

      {/* ── Right: Action Icons ── */}
      <div className="flex items-center gap-3">
        {/* Search shortcut hint */}
        <button
          onClick={() => {
            // Trigger Ctrl+K programmatically
            const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
            window.dispatchEvent(event);
          }}
          className="hidden lg:flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-white hover:border-[rgba(255,255,255,0.15)] transition-all"
          title="Global Search (Ctrl+K)"
        >
          <Search size={14} />
          <span>Search...</span>
          <kbd className="bg-[var(--bg-card)] border border-[rgba(255,255,255,0.08)] rounded px-1 text-[10px] font-mono font-bold ml-1">⌃K</kbd>
        </button>

        {/* Socket connection indicator */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold"
          title={isConnected ? "Real-time sync active" : "Connecting to server..."}
          style={{
            color: isConnected ? "var(--status-win)" : "var(--text-muted)",
            background: isConnected ? "rgba(0, 200, 100, 0.07)" : "rgba(255,255,255,0.04)",
          }}
        >
          {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span className="hidden xl:block">{isConnected ? "SYNC" : "OFFLINE"}</span>
        </div>

        {/* Notification Dropdown Removed per user request */}
        <button
          onClick={() => router.push("/settings")}
          className="w-9 h-9 rounded-full hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-colors"
        >
          <Settings size={18} />
        </button>
        <div className="h-4 w-px bg-[var(--border-default)] mx-1" />
        <IKFBadge variant="live" label="LIVE" size="sm" />
      </div>
    </header>
  );
}

// Keep backward compat alias
export { Topbar as TopBar };
