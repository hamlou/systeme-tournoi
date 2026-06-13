"use client";

import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   IKFSelect — Dark styled select dropdown matching IKFInput aesthetics
   Usage:
     <IKFSelect label="Weight Class" options={weightClasses} />
     <IKFSelect placeholder="Choose event..." onChange={...} />
───────────────────────────────────────────────────────────────────────────── */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface IKFSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  options?: SelectOption[];
  placeholder?: string;
  inputSize?: "sm" | "md" | "lg";
  containerClassName?: string;
}

const selectSizeClasses: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-3.5 py-2.5 text-sm",
  lg: "px-4 py-3 text-base",
};

export const IKFSelect = forwardRef<HTMLSelectElement, IKFSelectProps>(
  (
    {
      label,
      hint,
      error,
      options = [],
      placeholder,
      inputSize = "md",
      containerClassName,
      className,
      id,
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id ?? `ikf-select-${Math.random().toString(36).slice(2, 7)}`;
    const hasError = Boolean(error);

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={selectId}
            className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]"
          >
            {label}
          </label>
        )}

        {/* Select wrapper */}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined
            }
            className={cn(
              "w-full appearance-none",
              "bg-[var(--bg-elevated)]",
              "border border-[var(--border-default)]",
              "rounded-[var(--radius-md)]",
              "text-[var(--text-primary)]",
              "font-body",
              "outline-none",
              "cursor-pointer",
              "transition-all duration-150 ease-out",
              /* Hover */
              "hover:border-[rgba(255,255,255,0.12)]",
              /* Focus */
              "focus:border-[var(--ikf-red)]",
              "focus:shadow-[0_0_0_3px_var(--ikf-red-muted)]",
              /* Error */
              hasError && "border-[var(--ikf-red)] shadow-[0_0_0_3px_var(--ikf-red-muted)]",
              /* Padding + chevron space */
              "pr-9",
              selectSizeClasses[inputSize],
              /* Dropdown option styling (browser limited) */
              "[&>option]:bg-[#1c1f29] [&>option]:text-[var(--text-primary)]",
              "[&>option:disabled]:text-[var(--text-muted)]",
              className
            )}
            {...props}
          >
            {/* Placeholder option */}
            {placeholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}

            {/* Options from prop */}
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </option>
            ))}

            {/* Children options (manual) */}
            {children}
          </select>

          {/* Chevron icon */}
          <span className="absolute right-3 flex items-center pointer-events-none text-[var(--text-muted)]">
            <ChevronDown size={14} />
          </span>
        </div>

        {/* Error */}
        {error && (
          <p
            id={`${selectId}-error`}
            role="alert"
            className="text-[11px] text-[var(--ikf-red)] font-medium flex items-center gap-1"
          >
            <span aria-hidden="true">⚠</span> {error}
          </p>
        )}

        {/* Hint */}
        {hint && !error && (
          <p
            id={`${selectId}-hint`}
            className="text-[11px] text-[var(--text-muted)]"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

IKFSelect.displayName = "IKFSelect";

export default IKFSelect;
