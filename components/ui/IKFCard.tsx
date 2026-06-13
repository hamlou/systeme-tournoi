"use client";

import React from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   IKFCard — Premium dark card with optional glow variants
   Usage:
     <IKFCard>...</IKFCard>
     <IKFCard glowColor="red" className="p-8">...</IKFCard>
───────────────────────────────────────────────────────────────────────────── */

interface IKFCardProps {
  children: React.ReactNode;
  className?: string;
  /** Optional glow color on hover */
  glowColor?: "red" | "gold" | "blue" | "none";
  /** Padding preset */
  padding?: "none" | "sm" | "md" | "lg";
  /** Make the card interactive (adds cursor pointer) */
  interactive?: boolean;
  /** Called when card is clicked */
  onClick?: () => void;
  /** HTML id for accessibility and testing */
  id?: string;
}

const glowVariants: Record<string, string> = {
  red: "hover:border-[var(--border-active)] hover:shadow-[var(--shadow-card),var(--shadow-red-glow)]",
  gold: "hover:border-[rgba(212,160,23,0.4)] hover:shadow-[var(--shadow-card),var(--shadow-gold-glow)]",
  blue: "hover:border-[rgba(0,87,184,0.4)] hover:shadow-[var(--shadow-card),var(--shadow-blue-glow)]",
  none: "",
};

const paddingVariants: Record<string, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function IKFCard({
  children,
  className,
  glowColor = "red",
  padding = "md",
  interactive = false,
  onClick,
  id,
}: IKFCardProps) {
  return (
    <div
      id={id}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
      className={cn(
        /* Base */
        "relative overflow-hidden rounded-xl",
        "bg-[var(--bg-card)]",
        "border border-[var(--border-default)]",
        "shadow-card",
        /* Top gloss sheen */
        "before:absolute before:inset-0 before:rounded-xl",
        "before:bg-gradient-to-br before:from-white/[0.03] before:to-transparent",
        "before:pointer-events-none",
        /* Transition */
        "transition-all duration-250 ease-out",
        "hover:-translate-y-0.5",
        /* Glow on hover */
        glowVariants[glowColor],
        /* Padding */
        paddingVariants[padding],
        /* Interactive */
        interactive && "cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ikf-red)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export default IKFCard;
