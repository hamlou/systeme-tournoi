"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { X, Play, Trophy } from "lucide-react";
import toast from "react-hot-toast";
import type { Match } from "@/types/tournament";
import { useTournamentStore } from "@/store/tournamentStore";
import { IKFButton, IKFBadge } from "@/components/ui";

export function MatchDetailModal({ match, onClose }: { match: Match; onClose: () => void }) {
  const router = useRouter();
  const { setActiveMatch } = useTournamentStore();

  const handleSetActive = () => {
    setActiveMatch({ ...match, status: match.status === "scheduled" ? "in-progress" : match.status });
    toast.success(`Match #${match.matchNumber} loaded for round management`);
    onClose();
    router.push("/rounds");
  };

  const ready = match.redCornerId && match.blueCornerId && match.redCornerName !== "BYE" && match.blueCornerName !== "BYE";

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xs font-bold text-[var(--text-muted)] tracking-widest uppercase mb-1">{match.round} • Match #{match.matchNumber}</div>
            <h2 className="font-display text-3xl text-white">{match.category}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="space-y-3 mb-6">
          <div className={`flex items-center justify-between rounded-xl border p-4 ${match.result?.winnerCorner === "RED" ? "border-[var(--ikf-gold)] bg-[rgba(212,160,23,0.08)]" : "border-[var(--border-default)]"}`}>
            <span className="font-semibold text-[var(--ikf-red)]">{match.redCornerName || "TBD"}</span>
            <div className="flex items-center gap-2">
              {match.result?.winnerCorner === "RED" && <Trophy size={16} className="text-[var(--ikf-gold)]" />}
              {match.result && <span className="font-mono text-white">{match.result.redTotalScore}</span>}
            </div>
          </div>
          <div className={`flex items-center justify-between rounded-xl border p-4 ${match.result?.winnerCorner === "BLUE" ? "border-[var(--ikf-gold)] bg-[rgba(212,160,23,0.08)]" : "border-[var(--border-default)]"}`}>
            <span className="font-semibold text-[var(--corner-blue)]">{match.blueCornerName || "TBD"}</span>
            <div className="flex items-center gap-2">
              {match.result?.winnerCorner === "BLUE" && <Trophy size={16} className="text-[var(--ikf-gold)]" />}
              {match.result && <span className="font-mono text-white">{match.result.blueTotalScore}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm mb-6">
          <div><div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Mat</div><div className="text-white font-semibold">{match.matNumber}</div></div>
          <div><div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Time</div><div className="text-white font-semibold">{new Date(match.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div></div>
          <div><div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Status</div><IKFBadge variant={match.status === "completed" ? "win" : match.status === "in-progress" ? "live" : "pending"} label={match.status} size="sm" /></div>
        </div>

        {match.status !== "completed" && (
          <IKFButton variant="primary" fullWidth leftIcon={<Play size={16} />} disabled={!ready} onClick={handleSetActive}>
            {ready ? "Load for Round Management" : "Waiting for both fighters"}
          </IKFButton>
        )}
      </div>
    </div>
  );
}

export default MatchDetailModal;
