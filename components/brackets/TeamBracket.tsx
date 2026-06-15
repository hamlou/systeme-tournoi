"use client";

import React from "react";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import type { Bracket, Match } from "@/types/tournament";

interface Props {
  bracket: Bracket;
  matches: Match[];
  onMatchClick: (m: Match) => void;
}

export function TeamBracket({ bracket, matches, onMatchClick }: Props) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const matchups = bracket.teamMatchups ?? [];

  return (
    <div className="p-6 space-y-4">
      <div className="font-display text-2xl text-[var(--ikf-gold)] tracking-widest mb-2">TEAM TOURNAMENT</div>
      {matchups.map(tm => {
        const isOpen = expanded === tm.id;
        const fights = matches.filter(m => tm.individualMatchIds.includes(m.id));
        const redWon = tm.status === "complete" && tm.winnerId === tm.redClubId;
        const blueWon = tm.status === "complete" && tm.winnerId === tm.blueClubId;
        return (
          <div key={tm.id} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl overflow-hidden">
            <button onClick={() => setExpanded(isOpen ? null : tm.id)} className="w-full flex items-center justify-between p-5 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
              <div className="flex items-center gap-4">
                {isOpen ? <ChevronDown size={18} className="text-[var(--text-muted)]" /> : <ChevronRight size={18} className="text-[var(--text-muted)]" />}
                <span className={`font-display text-2xl flex items-center gap-2 ${redWon ? "text-[var(--ikf-gold)]" : "text-white"}`}>{redWon && <Trophy size={16} className="text-[var(--ikf-gold)]" />}{tm.redClubName}</span>
                <span className="text-[var(--text-muted)]">vs</span>
                <span className={`font-display text-2xl flex items-center gap-2 ${blueWon ? "text-[var(--ikf-gold)]" : "text-white"}`}>{blueWon && <Trophy size={16} className="text-[var(--ikf-gold)]" />}{tm.blueClubName}</span>
              </div>
              <div className="font-mono text-lg">
                <span className="text-[var(--ikf-red)] font-bold">{tm.redWins} wins</span>
                <span className="text-[var(--text-muted)] mx-2">—</span>
                <span className="text-[var(--corner-blue)] font-bold">{tm.blueWins} wins</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-[var(--border-default)]">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] bg-[var(--bg-elevated)]">
                    <tr>
                      <th className="py-2 px-4 text-left">Category</th><th className="py-2 px-4 text-left">Red Fighter</th>
                      <th className="py-2 px-4 text-left">Blue Fighter</th><th className="py-2 px-4 text-left">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fights.map(f => {
                      const redWin = f.result?.winnerId === f.redCornerId;
                      const blueWin = f.result?.winnerId === f.blueCornerId;
                      return (
                        <tr key={f.id} onClick={() => onMatchClick(f)} className="border-t border-[rgba(255,255,255,0.04)] cursor-pointer hover:bg-[rgba(255,255,255,0.03)]">
                          <td className="py-2 px-4 font-mono text-[var(--text-secondary)]">{f.weightCategory}</td>
                          <td className={`py-2 px-4 ${redWin ? "text-[var(--ikf-gold)] font-bold" : "text-white"}`}>{f.redCornerName}</td>
                          <td className={`py-2 px-4 ${blueWin ? "text-[var(--ikf-gold)] font-bold" : "text-white"}`}>{f.blueCornerName}</td>
                          <td className="py-2 px-4">
                            {f.status === "completed" && f.result
                              ? <span className="text-[var(--ikf-gold)]">{redWin ? f.redCornerName : f.blueCornerName} won</span>
                              : <span className="text-[var(--text-muted)]">{new Date(f.scheduledTime || 0).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {fights.length === 0 && <tr><td colSpan={4} className="py-4 px-4 text-center text-[var(--text-muted)]">No individual fights (no shared weight categories).</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      {matchups.length === 0 && <div className="py-16 text-center text-[var(--text-muted)]">No team matchups generated.</div>}
    </div>
  );
}

export default TeamBracket;
