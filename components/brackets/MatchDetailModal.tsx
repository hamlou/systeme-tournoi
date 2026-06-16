"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play, Trophy, X } from "lucide-react";
import toast from "react-hot-toast";
import type { Match } from "@/types/tournament";
import { formatMatchCategory } from "@/lib/ageCategories";
import { useTournamentStore } from "@/store/tournamentStore";
import { IKFButton, IKFBadge } from "@/components/ui";

export function MatchDetailModal({ match, onClose }: { match: Match; onClose: () => void }) {
  const router = useRouter();
  const { setActiveMatch, confirmBracketWinner } = useTournamentStore();
  const [pendingWinner, setPendingWinner] = React.useState<"RED" | "BLUE" | null>(null);

  const handleSetActive = () => {
    setActiveMatch({ ...match, status: match.status === "scheduled" ? "in-progress" : match.status });
    toast.success(`Match #${match.matchNumber} loaded for round management`);
    onClose();
    router.push("/rounds");
  };

  const invalidNames = ["BYE", "TBD", "Priority winner", "Semifinal winner", "WB Champion", "LB Champion"];
  const ready = Boolean(
    match.redCornerId &&
    match.blueCornerId &&
    !invalidNames.includes(match.redCornerName) &&
    !invalidNames.includes(match.blueCornerName)
  );

  const handleConfirmWinner = () => {
    if (!pendingWinner) return;
    confirmBracketWinner(match.id, pendingWinner);
    setPendingWinner(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xs font-bold text-[var(--text-muted)] tracking-widest uppercase mb-1">{match.round} • Match #{match.matchNumber}</div>
            <h2 className="font-display text-3xl text-white">{formatMatchCategory(match.ageGroup, match.weightCategory, match.gender)}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="space-y-3 mb-6">
          <div className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${match.result?.winnerCorner === "RED" ? "border-[var(--ikf-gold)] bg-[rgba(212,160,23,0.08)]" : "border-[var(--border-default)]"}`}>
            <span className="font-semibold text-[var(--ikf-red)] truncate">{match.redCornerName || "TBD"}</span>
            <div className="flex items-center gap-2">
              {match.result?.winnerCorner === "RED" && <Trophy size={16} className="text-[var(--ikf-gold)]" />}
              {match.result && <span className="font-mono text-white">{match.result.redTotalScore}</span>}
              {match.status !== "completed" && (
                <IKFButton size="xs" variant="secondary" disabled={!ready} leftIcon={<CheckCircle2 size={13} />} onClick={() => setPendingWinner("RED")}>
                  Winner
                </IKFButton>
              )}
            </div>
          </div>
          <div className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${match.result?.winnerCorner === "BLUE" ? "border-[var(--ikf-gold)] bg-[rgba(212,160,23,0.08)]" : "border-[var(--border-default)]"}`}>
            <span className="font-semibold text-[var(--corner-blue)] truncate">{match.blueCornerName || "TBD"}</span>
            <div className="flex items-center gap-2">
              {match.result?.winnerCorner === "BLUE" && <Trophy size={16} className="text-[var(--ikf-gold)]" />}
              {match.result && <span className="font-mono text-white">{match.result.blueTotalScore}</span>}
              {match.status !== "completed" && (
                <IKFButton size="xs" variant="secondary" disabled={!ready} leftIcon={<CheckCircle2 size={13} />} onClick={() => setPendingWinner("BLUE")}>
                  Winner
                </IKFButton>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm mb-6">
          <div><div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Mat</div><div className="text-white font-semibold">{match.matNumber}</div></div>
          <div><div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Time</div><div className="text-white font-semibold">{new Date(match.scheduledTime || 0).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div></div>
          <div><div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Status</div><IKFBadge variant={match.status === "completed" ? "win" : match.status === "in-progress" ? "live" : "pending"} label={match.status} size="sm" /></div>
        </div>

        {match.status !== "completed" && (
          <div className="space-y-3">
            <IKFButton variant="primary" fullWidth leftIcon={<Play size={16} />} disabled={!ready} onClick={handleSetActive}>
              {ready ? "Load for Round Management" : "Waiting for both fighters"}
            </IKFButton>
          </div>
        )}

        {pendingWinner && (
          <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPendingWinner(null)}>
            <div className="bg-[var(--bg-elevated)] border border-[var(--ikf-gold)] rounded-xl p-6 max-w-sm w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
              <Trophy size={36} className="mx-auto mb-3 text-[var(--ikf-gold)]" />
              <h3 className="font-display text-2xl text-white mb-2">Confirm Winner</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-5">
                Advance {pendingWinner === "RED" ? match.redCornerName : match.blueCornerName} from Match #{match.matchNumber}?
              </p>
              <div className="flex gap-3">
                <IKFButton variant="ghost" fullWidth onClick={() => setPendingWinner(null)}>Cancel</IKFButton>
                <IKFButton variant="gold" fullWidth leftIcon={<CheckCircle2 size={16} />} onClick={handleConfirmWinner}>Confirm</IKFButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MatchDetailModal;
