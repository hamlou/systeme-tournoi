"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   IKFInput — Dark styled input with red focus ring and optional label
   Usage:
     <IKFInput placeholder="Search fighters..." />
     <IKFInput label="Fighter Name" error="Required" leftIcon={<Search />} />
───────────────────────────────────────────────────────────────────────────── */

interface IKFInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  inputSize?: "sm" | "md" | "lg";
  containerClassName?: string;
}

const inputSizeClasses: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-3.5 py-2.5 text-sm",
  lg: "px-4 py-3 text-base",
};

export const IKFInput = forwardRef<HTMLInputElement, IKFInputProps>(
  (
    {
      label,
      hint,
      error,
      leftIcon,
      rightIcon,
      inputSize = "md",
      containerClassName,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? `ikf-input-${Math.random().toString(36).slice(2, 7)}`;
    const hasError = Boolean(error);

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]"
          >
            {label}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative flex items-center group">
          {/* Left icon */}
          {leftIcon && (
            <span className="absolute left-3 flex items-center text-[var(--text-muted)] group-focus-within:text-[var(--ikf-red)] transition-colors duration-150 pointer-events-none z-10">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            className={cn(
              "w-full",
              "bg-[var(--bg-elevated)]",
              "border border-[var(--border-default)]",
              "rounded-[var(--radius-md)]",
              "text-[var(--text-primary)]",
              "placeholder:text-[var(--text-muted)]",
              "font-body",
              "outline-none",
              "transition-all duration-150 ease-out",
              /* Hover */
              "hover:border-[rgba(255,255,255,0.12)]",
              /* Focus */
              "focus:border-[var(--ikf-red)]",
              "focus:shadow-[0_0_0_3px_var(--ikf-red-muted)]",
              /* Error */
              hasError && "border-[var(--ikf-red)] shadow-[0_0_0_3px_var(--ikf-red-muted)]",
              /* Icon padding adjustments */
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              /* Size */
              inputSizeClasses[inputSize],
              className
            )}
            {...props}
          />

          {/* Right icon */}
          {rightIcon && (
            <span className="absolute right-3 flex items-center text-[var(--text-muted)] group-focus-within:text-[var(--text-secondary)] transition-colors duration-150 pointer-events-none z-10">
              {rightIcon}
            </span>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-[11px] text-[var(--ikf-red)] font-medium flex items-center gap-1"
          >
            <span aria-hidden="true">⚠</span> {error}
          </p>
        )}

        {/* Hint text */}
        {hint && !error && (
          <p
            id={`${inputId}-hint`}
            className="text-[11px] text-[var(--text-muted)]"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

IKFInput.displayName = "IKFInput";

export default IKFInput;
