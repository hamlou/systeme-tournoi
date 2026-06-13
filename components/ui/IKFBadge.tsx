"use client";

import React from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   IKFBadge — Status badge with animated LIVE variant
   Usage:
     <IKFBadge variant="live" />
     <IKFBadge variant="win" label="KO Win" />
───────────────────────────────────────────────────────────────────────────── */

type BadgeVariant = "live" | "win" | "loss" | "draw" | "pending" | "upcoming" | "cancelled";

interface IKFBadgeProps {
  variant: BadgeVariant;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  id?: string;
}

const variantConfig: Record<
  BadgeVariant,
  {
    defaultLabel: string;
    containerClass: string;
    dotClass: string;
    showDot: boolean;
  }
> = {
  live: {
    defaultLabel: "LIVE",
    containerClass:
      "bg-[rgba(255,68,68,0.12)] border-[rgba(255,68,68,0.3)] text-[var(--status-live)]",
    dotClass: "bg-[var(--status-live)] animate-pulse-live",
    showDot: true,
  },
  win: {
    defaultLabel: "WIN",
    containerClass:
      "bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.25)] text-[var(--status-win)]",
    dotClass: "bg-[var(--status-win)]",
    showDot: false,
  },
  loss: {
    defaultLabel: "LOSS",
    containerClass:
      "bg-[var(--ikf-red-muted)] border-[rgba(200,16,46,0.25)] text-[var(--status-loss)]",
    dotClass: "bg-[var(--status-loss)]",
    showDot: false,
  },
  draw: {
    defaultLabel: "DRAW",
    containerClass:
      "bg-[rgba(212,160,23,0.1)] border-[rgba(212,160,23,0.25)] text-[var(--ikf-gold)]",
    dotClass: "bg-[var(--ikf-gold)]",
    showDot: false,
  },
  pending: {
    defaultLabel: "PENDING",
    containerClass:
      "bg-[rgba(139,144,160,0.1)] border-[rgba(139,144,160,0.2)] text-[var(--text-secondary)]",
    dotClass: "bg-[var(--text-muted)]",
    showDot: true,
  },
  upcoming: {
    defaultLabel: "UPCOMING",
    containerClass:
      "bg-[rgba(0,87,184,0.1)] border-[rgba(0,87,184,0.25)] text-[#3b82f6]",
    dotClass: "bg-[#3b82f6]",
    showDot: false,
  },
  cancelled: {
    defaultLabel: "CANCELLED",
    containerClass:
      "bg-[rgba(74,79,96,0.15)] border-[rgba(74,79,96,0.3)] text-[var(--text-muted)]",
    dotClass: "bg-[var(--text-muted)]",
    showDot: false,
  },
};

const sizeClasses: Record<string, string> = {
  sm: "px-2 py-0.5 text-[10px] gap-1.5",
  md: "px-2.5 py-1 text-[11px] gap-1.5",
  lg: "px-3 py-1.5 text-xs gap-2",
};

const dotSizeClasses: Record<string, string> = {
  sm: "w-1.5 h-1.5",
  md: "w-1.5 h-1.5",
  lg: "w-2 h-2",
};

export function IKFBadge({
  variant,
  label,
  className,
  size = "md",
  id,
}: IKFBadgeProps) {
  const config = variantConfig[variant];
  const displayLabel = label ?? config.defaultLabel;

  return (
    <span
      id={id}
      className={cn(
        "inline-flex items-center rounded-full border font-mono font-semibold tracking-widest uppercase",
        config.containerClass,
        sizeClasses[size],
        className
      )}
    >
      {config.showDot && (
        <span
          className={cn(
            "rounded-full flex-shrink-0",
            config.dotClass,
            dotSizeClasses[size]
          )}
          aria-hidden="true"
        />
      )}
      {!config.showDot && variant !== "pending" && (
        <span
          className={cn(
            "rounded-full flex-shrink-0 opacity-70",
            config.dotClass,
            dotSizeClasses[size]
          )}
          aria-hidden="true"
        />
      )}
      {displayLabel}
    </span>
  );
}

export default IKFBadge;
