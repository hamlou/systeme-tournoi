"use client";

import { Clock } from "lucide-react";
import { IKFButton } from "@/components/ui";
import { getMatchTimeRemaining } from "@/hooks/useMatchNotifications";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Match } from "@/types/tournament";

interface UpcomingMatchAlertProps {
  matches: Match[];
}

export function UpcomingMatchAlert({ matches }: UpcomingMatchAlertProps) {
  const { updateMatch, setActiveMatch } = useTournamentStore();
  const match = matches[0];
  if (!match) return null;

  const startNow = () => {
    updateMatch(match.id, { status: "in-progress" });
    setActiveMatch({ ...match, status: "in-progress" });
  };

  return (
    <div className="fixed top-20 left-0 right-0 z-50 bg-[var(--ikf-red)] p-4 shadow-xl animate-pulse no-print">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Clock className="text-white" size={24} />
          <span className="text-white font-bold">
            Match #{match.matchNumber} starting in {getMatchTimeRemaining(match)} - Mat {match.matNumber}
          </span>
          <span className="text-white/85">
            {match.redCornerName} vs {match.blueCornerName}
          </span>
          {matches.length > 1 && <span className="text-white/70 text-sm">+{matches.length - 1} more starting soon</span>}
        </div>
        <IKFButton variant="gold" onClick={startNow}>Start Now</IKFButton>
      </div>
    </div>
  );
}
