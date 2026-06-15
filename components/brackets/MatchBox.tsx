"use client";

import React from "react";
import { Trophy } from "lucide-react";
import type { Match } from "@/types/tournament";
import { IKFBadge } from "@/components/ui";

interface MatchBoxProps {
  match: Match;
  onClick?: (match: Match) => void;
  compact?: boolean;
}

export function MatchBox({ match, onClick, compact }: MatchBoxProps) {
  const isRedWinner = match.result?.winnerCorner === "RED";
  const isBlueWinner = match.result?.winnerCorner === "BLUE";
  const redScore = match.result?.redTotalScore;
  const blueScore = match.result?.blueTotalScore;

  const time = new Date(match.scheduledTime || 0).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <button
      type="button"
      onClick={() => onClick?.(match)}
      className={`text-left ${compact ? "w-[200px]" : "w-[220px]"} bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg overflow-hidden flex flex-col shadow-card relative z-10 hover:border-[var(--ikf-gold)] transition-colors`}
    >
      <div className="bg-[var(--bg-elevated)] p-2 flex justify-between items-center border-b border-[var(--border-default)] text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase">
        <span>Mat {match.matNumber} • {time}</span>
        <span>M#{match.matchNumber}</span>
      </div>

      <div className={`p-3 border-l-4 border-[var(--ikf-red)] border-b border-[var(--border-default)] flex justify-between items-center transition-colors ${isRedWinner ? "bg-[rgba(200,16,46,0.1)]" : ""}`}>
        <span className={`font-semibold text-sm truncate pr-2 ${match.redCornerName === "BYE" ? "text-[var(--text-muted)] italic" : isBlueWinner ? "text-[var(--text-muted)] line-through" : isRedWinner ? "text-[var(--ikf-gold)]" : "text-white"}`}>
          {match.redCornerName || <span className="text-[var(--text-muted)] italic">TBD</span>}
        </span>
        <div className="flex items-center gap-2">
          {isRedWinner && <Trophy size={14} className="text-[var(--ikf-gold)]" />}
          {redScore !== undefined && <span className={`font-mono text-sm font-bold ${isRedWinner ? "text-[var(--ikf-gold)]" : "text-white"}`}>{redScore}</span>}
        </div>
      </div>

      <div className={`p-3 border-l-4 border-[var(--corner-blue)] flex justify-between items-center transition-colors ${isBlueWinner ? "bg-[rgba(0,102,204,0.1)]" : ""}`}>
        <span className={`font-semibold text-sm truncate pr-2 ${match.blueCornerName === "BYE" ? "text-[var(--text-muted)] italic" : isRedWinner ? "text-[var(--text-muted)] line-through" : isBlueWinner ? "text-[var(--ikf-gold)]" : "text-white"}`}>
          {match.blueCornerName || <span className="text-[var(--text-muted)] italic">TBD</span>}
        </span>
        <div className="flex items-center gap-2">
          {isBlueWinner && <Trophy size={14} className="text-[var(--ikf-gold)]" />}
          {blueScore !== undefined && <span className={`font-mono text-sm font-bold ${isBlueWinner ? "text-[var(--ikf-gold)]" : "text-white"}`}>{blueScore}</span>}
        </div>
      </div>

      {match.status !== "scheduled" && (
        <div className="absolute top-0 right-0 -mt-2 -mr-2">
          <IKFBadge variant={match.status === "completed" ? "win" : "live"} label={match.status} size="sm" />
        </div>
      )}
    </button>
  );
}

export default MatchBox;
