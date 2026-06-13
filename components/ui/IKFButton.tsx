"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   IKFButton — Multi-variant button with loading state and icon support
   Usage:
     <IKFButton variant="primary" onClick={...}>Submit</IKFButton>
     <IKFButton variant="gold" leftIcon={<Trophy />}>Champion</IKFButton>
     <IKFButton variant="danger" loading>Disqualify</IKFButton>
───────────────────────────────────────────────────────────────────────────── */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

interface IKFButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    "bg-[var(--ikf-red)] text-white border-[var(--ikf-red)]",
    "hover:bg-[#e0112f] hover:border-[#e0112f]",
    "hover:shadow-[0_4px_20px_rgba(200,16,46,0.45)]",
    "active:bg-[#a80d26]",
    "focus-visible:ring-[var(--ikf-red)]",
  ].join(" "),

  secondary: [
    "bg-transparent text-[var(--ikf-red)] border-[var(--ikf-red)]",
    "hover:bg-[var(--ikf-red-muted)]",
    "hover:shadow-[0_4px_16px_rgba(200,16,46,0.2)]",
    "focus-visible:ring-[var(--ikf-red)]",
  ].join(" "),

  ghost: [
    "bg-transparent text-[var(--text-secondary)] border-transparent",
    "hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text-primary)]",
    "focus-visible:ring-[rgba(255,255,255,0.3)]",
  ].join(" "),

  danger: [
    "bg-[#ff1a1a] text-white border-[#ff1a1a]",
    "hover:bg-[#ff3333] hover:border-[#ff3333]",
    "hover:shadow-[0_4px_24px_rgba(255,26,26,0.5)]",
    "active:bg-[#cc0000]",
    "focus-visible:ring-red-500",
  ].join(" "),

  gold: [
    "bg-[var(--ikf-gold)] text-[#0a0b0f] border-[var(--ikf-gold)] font-bold",
    "hover:bg-[#e6b01e] hover:border-[#e6b01e]",
    "hover:shadow-[0_4px_24px_rgba(212,160,23,0.5)]",
    "active:bg-[#b88a14]",
    "focus-visible:ring-[var(--ikf-gold)]",
  ].join(" "),
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "px-2.5 py-1 text-[11px] gap-1 rounded-[var(--radius-sm)]",
  sm: "px-3.5 py-1.5 text-xs gap-1.5 rounded-[var(--radius-md)]",
  md: "px-5 py-2.5 text-sm gap-2 rounded-[var(--radius-md)]",
  lg: "px-6 py-3 text-base gap-2.5 rounded-[var(--radius-lg)]",
  xl: "px-8 py-4 text-lg gap-3 rounded-[var(--radius-xl)]",
};

export function IKFButton({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  children,
  className,
  ...props
}: IKFButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      aria-busy={loading}
      className={cn(
        /* Base */
        "inline-flex items-center justify-center",
        "font-body font-semibold tracking-wide",
        "border cursor-pointer",
        "transition-all duration-150 ease-out",
        "select-none whitespace-nowrap",
        /* Ripple overlay pseudo (via ::after in globals) */
        "relative overflow-hidden",
        "after:absolute after:inset-0 after:rounded-inherit after:bg-white/0",
        "hover:after:bg-white/[0.04]",
        "active:scale-[0.97]",
        /* Focus ring */
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
        /* Disabled state */
        isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
        /* Variants */
        variantClasses[variant],
        /* Sizes */
        sizeClasses[size],
        /* Full width */
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={14} />
      ) : (
        leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && rightIcon && (
        <span className="flex-shrink-0">{rightIcon}</span>
      )}
    </button>
  );
}

export default IKFButton;
