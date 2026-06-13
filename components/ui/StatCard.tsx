"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   StatCard — Premium metric display card with animated number
   Usage:
     <StatCard label="Total Fighters" value="1,247" trend={+12} />
     <StatCard label="Win Rate" value="68%" trendLabel="vs last season" accentColor="gold" />
     <StatCard label="Active Events" value="3" badge={<IKFBadge variant="live" />} />
───────────────────────────────────────────────────────────────────────────── */

type TrendDirection = "up" | "down" | "neutral";
type AccentColor = "red" | "gold" | "blue" | "green" | "none";

interface StatCardProps {
  label: string;
  value: string | number;
  /** Numeric change, positive = up, negative = down, 0 = neutral */
  trend?: number;
  /** Override the trend label text */
  trendLabel?: string;
  /** Optional secondary line below value */
  subtitle?: string;
  /** A badge element (e.g. IKFBadge) rendered top-right */
  badge?: React.ReactNode;
  /** An icon element rendered top-left beside label */
  icon?: React.ReactNode;
  /** Accent color for the top border strip */
  accentColor?: AccentColor;
  className?: string;
  id?: string;
}

const accentBorders: Record<AccentColor, string> = {
  red: "from-[var(--ikf-red)] via-[rgba(200,16,46,0.5)] to-transparent",
  gold: "from-[var(--ikf-gold)] via-[rgba(212,160,23,0.5)] to-transparent",
  blue: "from-[#0057b8] via-[rgba(0,87,184,0.5)] to-transparent",
  green: "from-[var(--status-win)] via-[rgba(34,197,94,0.5)] to-transparent",
  none: "from-transparent to-transparent",
};

const trendColors: Record<TrendDirection, string> = {
  up: "text-[var(--status-win)]",
  down: "text-[var(--status-loss)]",
  neutral: "text-[var(--text-muted)]",
};

function getTrendDirection(trend: number): TrendDirection {
  if (trend > 0) return "up";
  if (trend < 0) return "down";
  return "neutral";
}

function TrendIcon({ direction }: { direction: TrendDirection }) {
  if (direction === "up") return <TrendingUp size={13} />;
  if (direction === "down") return <TrendingDown size={13} />;
  return <Minus size={13} />;
}

export function StatCard({
  label,
  value,
  trend,
  trendLabel,
  subtitle,
  badge,
  icon,
  accentColor = "red",
  className,
  id,
}: StatCardProps) {
  const hasTrend = trend !== undefined && trend !== null;
  const trendDir = hasTrend ? getTrendDirection(trend!) : null;
  const trendStr = hasTrend
    ? `${trend! > 0 ? "+" : ""}${trend}%`
    : null;

  return (
    <div
      id={id}
      className={cn(
        "relative overflow-hidden rounded-xl",
        "bg-[var(--bg-card)]",
        "border border-[var(--border-default)]",
        "shadow-card",
        "p-5",
        "transition-all duration-250 ease-out",
        "hover:-translate-y-0.5",
        "group",
        className
      )}
    >
      {/* Top gradient accent border strip */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r",
          accentBorders[accentColor]
        )}
      />

      {/* Subtle gloss sheen */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-white/[0.025] to-transparent pointer-events-none rounded-xl"
      />

      {/* Header row: label + badge */}
      <div className="relative flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="text-[var(--text-muted)] flex-shrink-0 group-hover:text-[var(--ikf-red)] transition-colors duration-200">
              {icon}
            </span>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] font-body truncate">
            {label}
          </span>
        </div>
        {badge && <div className="flex-shrink-0">{badge}</div>}
      </div>

      {/* Main value */}
      <div className="relative mb-2">
        <p
          className="font-display text-[clamp(2.5rem,6vw,4rem)] leading-none tracking-wide text-[var(--text-primary)] animate-number-tick"
          aria-label={`${label}: ${value}`}
        >
          {value}
        </p>
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-[var(--text-muted)] font-body mb-2">
          {subtitle}
        </p>
      )}

      {/* Trend indicator */}
      {hasTrend && trendDir && (
        <div
          className={cn(
            "inline-flex items-center gap-1",
            "text-[11px] font-semibold font-mono",
            trendColors[trendDir]
          )}
          aria-label={`Trend: ${trendStr}${trendLabel ? ` ${trendLabel}` : ""}`}
        >
          <TrendIcon direction={trendDir} />
          <span>{trendStr}</span>
          {trendLabel && (
            <span className="text-[var(--text-muted)] font-normal">
              {trendLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default StatCard;
