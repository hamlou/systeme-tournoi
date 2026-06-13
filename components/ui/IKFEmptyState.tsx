import React from "react";
import { FolderOpen } from "lucide-react";
import { IKFButton } from "./IKFButton";

interface IKFEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function IKFEmptyState({
  icon = <FolderOpen size={48} />,
  title,
  subtitle,
  actionLabel,
  onAction,
}: IKFEmptyStateProps) {
  return (
    <div className="w-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-[rgba(255,255,255,0.05)] rounded-2xl bg-[var(--bg-elevated)] min-h-[300px]">
      <div className="text-[var(--text-muted)] mb-4 opacity-50">{icon}</div>
      <h3 className="text-xl font-bold text-white tracking-wide mb-2">{title}</h3>
      {subtitle && <p className="text-[var(--text-muted)] text-sm max-w-md mb-6">{subtitle}</p>}
      {actionLabel && onAction && (
        <IKFButton variant="primary" onClick={onAction}>
          {actionLabel}
        </IKFButton>
      )}
    </div>
  );
}
