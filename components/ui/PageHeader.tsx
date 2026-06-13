"use client";

import React from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   PageHeader — Premium page title block with category label and red accent
   Usage:
     <PageHeader
       category="Athletes"
       title="Fighter Roster"
       subtitle="Manage registered athletes and their profiles"
     />
───────────────────────────────────────────────────────────────────────────── */

interface PageHeaderProps {
  /** Small uppercase category label above title */
  category?: string;
  /** Main display-font title (Bebas Neue) */
  title: string;
  /** Optional subtitle/description line */
  subtitle?: string;
  /** Optional right-side action slot (buttons, etc.) */
  actions?: React.ReactNode;
  /** Optional small icon before the category label */
  categoryIcon?: React.ReactNode;
  className?: string;
  id?: string;
}

export function PageHeader({
  category,
  title,
  subtitle,
  actions,
  categoryIcon,
  className,
  id,
}: PageHeaderProps) {
  return (
    <header
      id={id}
      className={cn(
        "flex items-start justify-between gap-6 mb-8",
        className
      )}
    >
      {/* Left: text block */}
      <div className="flex flex-col gap-2 min-w-0">
        {/* Category label */}
        {category && (
          <div className="flex items-center gap-2">
            {categoryIcon && (
              <span className="text-[var(--ikf-red)] flex-shrink-0 opacity-80">
                {categoryIcon}
              </span>
            )}
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[var(--text-muted)] font-body">
              {category}
            </span>
          </div>
        )}

        {/* Main title */}
        <div className="relative">
          <h1
            className={cn(
              "font-display text-[clamp(2.5rem,5vw,3.5rem)] leading-none tracking-wide",
              "text-[var(--text-primary)]",
              "truncate"
            )}
          >
            {title}
          </h1>

          {/* Red underline accent */}
          <div
            aria-hidden="true"
            className="mt-2 flex items-center gap-2"
          >
            <div className="h-[3px] w-12 rounded-full bg-gradient-to-r from-[var(--ikf-red)] to-[rgba(200,16,46,0.3)]" />
            <div className="h-[1px] w-6 rounded-full bg-[var(--border-default)]" />
          </div>
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--text-secondary)] font-body leading-relaxed max-w-xl">
            {subtitle}
          </p>
        )}
      </div>

      {/* Right: action slot */}
      {actions && (
        <div className="flex items-center gap-3 flex-shrink-0 mt-1">
          {actions}
        </div>
      )}
    </header>
  );
}

export default PageHeader;
