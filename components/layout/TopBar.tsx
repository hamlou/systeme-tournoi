"use client";

import React from "react";
import { Settings, Search, Wifi, WifiOff } from "lucide-react";
import { useNavigationStore } from "@/store/navigationStore";
import { IKFBadge } from "@/components/ui/IKFBadge";
import { useSocket } from "@/components/providers/SocketProvider";
import { useRouter } from "next/navigation";

export function Topbar() {
  const { activePage } = useNavigationStore();
  const { isConnected } = useSocket();
  const router = useRouter();

  return (
    <header className="h-[56px] sm:h-[64px] bg-[var(--bg-secondary)]/95 backdrop-blur-md border-b border-[var(--border-default)] z-40 flex items-center justify-between gap-2 px-3 sm:px-6 flex-shrink-0">
      {/* ── Left: Current Page Title ── */}
      <div className="flex min-w-0 items-center">
        <h2 className="truncate font-display text-xl sm:text-2xl text-[var(--text-primary)] tracking-wide">
          {activePage}
        </h2>
      </div>

      {/* ── Center: Tournament Name ── */}
      <div className="absolute left-1/2 -translate-x-1/2 items-center gap-3 hidden xl:flex">
        <span className="font-display text-xl text-[var(--ikf-gold)] tracking-widest drop-shadow-[0_0_8px_rgba(212,160,23,0.3)]">
          IKF WORLD CHAMPIONSHIP 2026
        </span>
        <IKFBadge variant="live" size="sm" />
      </div>

      {/* ── Right: Action Icons ── */}
      <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
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
          className="flex items-center gap-1.5 px-1.5 sm:px-2 py-1 rounded-md text-xs font-bold"
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
        <div className="hidden sm:block h-4 w-px bg-[var(--border-default)] mx-1" />
        <span className="hidden sm:inline-flex"><IKFBadge variant="live" label="LIVE" size="sm" /></span>
      </div>
    </header>
  );
}

// Keep backward compat alias
export { Topbar as TopBar };
