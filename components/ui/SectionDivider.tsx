"use client";

import React from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   SectionDivider — Sophisticated section divider with centered label
   Usage:
     <SectionDivider label="Fight Statistics" />
     <SectionDivider label="Recent Events" accent="gold" />
     <SectionDivider />  (plain horizontal rule)
───────────────────────────────────────────────────────────────────────────── */

interface SectionDividerProps {
  label?: string;
  accent?: "red" | "gold" | "blue" | "muted";
  className?: string;
  id?: string;
  /** Optional icon before label */
  icon?: React.ReactNode;
}

const accentColors: Record<string, string> = {
  red: "text-[var(--ikf-red)]",
  gold: "text-[var(--ikf-gold)]",
  blue: "text-[#3b82f6]",
  muted: "text-[var(--text-muted)]",
};

const lineAccentGradients: Record<string, { left: string; right: string }> = {
  red: {
    left: "from-transparent via-[rgba(200,16,46,0.3)] to-[rgba(200,16,46,0.15)]",
    right: "from-[rgba(200,16,46,0.15)] via-[rgba(200,16,46,0.3)] to-transparent",
  },
  gold: {
    left: "from-transparent via-[rgba(212,160,23,0.3)] to-[rgba(212,160,23,0.15)]",
    right: "from-[rgba(212,160,23,0.15)] via-[rgba(212,160,23,0.3)] to-transparent",
  },
  blue: {
    left: "from-transparent via-[rgba(0,87,184,0.3)] to-[rgba(0,87,184,0.15)]",
    right: "from-[rgba(0,87,184,0.15)] via-[rgba(0,87,184,0.3)] to-transparent",
  },
  muted: {
    left: "from-transparent to-[var(--border-default)]",
    right: "from-[var(--border-default)] to-transparent",
  },
};

export function SectionDivider({
  label,
  accent = "muted",
  className,
  id,
  icon,
}: SectionDividerProps) {
  const gradients = lineAccentGradients[accent];

  if (!label) {
    return (
      <div
        id={id}
        role="separator"
        aria-orientation="horizontal"
        className={cn("relative flex items-center my-6", className)}
      >
        <div className="flex-1 h-px bg-[var(--border-default)]" />
      </div>
    );
  }

  return (
    <div
      id={id}
      role="separator"
      aria-label={label}
      className={cn(
        "relative flex items-center gap-4 my-8",
        className
      )}
    >
      {/* Left line */}
      <div
        aria-hidden="true"
        className={cn(
          "flex-1 h-px bg-gradient-to-r",
          gradients.left
        )}
      />

      {/* Center label */}
      <div
        className={cn(
          "flex items-center gap-1.5 flex-shrink-0",
          "px-3 py-1",
          "rounded-full",
          "border border-[var(--border-default)]",
          "bg-[var(--bg-secondary)]",
        )}
      >
        {icon && (
          <span
            className={cn("flex items-center", accentColors[accent])}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <span
          className={cn(
            "text-[10px] font-semibold tracking-[0.2em] uppercase font-body",
            accentColors[accent]
          )}
        >
          {label}
        </span>
      </div>

      {/* Right line */}
      <div
        aria-hidden="true"
        className={cn(
          "flex-1 h-px bg-gradient-to-r",
          gradients.right
        )}
      />
    </div>
  );
}

export default SectionDivider;
