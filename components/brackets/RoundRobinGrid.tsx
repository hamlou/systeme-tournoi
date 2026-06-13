"use client";

import React from "react";
import type { Match, Standing, Athlete } from "@/types/tournament";

interface Props {
  athletes: Athlete[];
  matches: Match[];
  standings: Standing[];
  onMatchClick?: (m: Match) => void;
  compact?: boolean;
}

export function RoundRobinGrid({ athletes, matches, standings, onMatchClick, compact }: Props) {
  const findMatch = (rowId: string, colId: string) =>
    matches.find(m =>
      (m.redCornerId === rowId && m.blueCornerId === colId) ||
      (m.redCornerId === colId && m.blueCornerId === rowId));

  const cellContent = (rowId: string, colId: string): { cls: string; text: string; match?: Match } => {
    if (rowId === colId) return { cls: "bg-[var(--bg-elevated)]", text: "—" };
    const m = findMatch(rowId, colId);
    if (!m) return { cls: "", text: "" };
    if (m.status !== "completed" || !m.result) {
      return { cls: "text-[var(--text-muted)] text-[10px]", text: new Date(m.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), match: m };
    }
    const isDraw = m.result.method === "draw";
    const rowIsRed = m.redCornerId === rowId;
    const rowScore = rowIsRed ? m.result.redTotalScore : m.result.blueTotalScore;
    const colScore = rowIsRed ? m.result.blueTotalScore : m.result.redTotalScore;
    const rowWon = m.result.winnerId === rowId;
    const cls = isDraw
      ? "bg-[rgba(212,160,23,0.18)] text-[var(--ikf-gold)]"
      : rowWon ? "bg-[rgba(46,204,113,0.18)] text-[var(--status-win)]" : "bg-[rgba(200,16,46,0.18)] text-[var(--ikf-red)]";
    return { cls, text: `${rowScore}-${colScore}`, match: m };
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="p-2"></th>
              {athletes.map(a => (
                <th key={a.id} className="p-2 text-[var(--text-muted)] font-semibold whitespace-nowrap" title={a.fullName}>
                  {a.fullName.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {athletes.map(row => (
              <tr key={row.id}>
                <td className="p-2 text-left text-white font-semibold whitespace-nowrap pr-4">{row.fullName}</td>
                {athletes.map(col => {
                  const c = cellContent(row.id, col.id);
                  return (
                    <td key={col.id} className="p-1">
                      <button
                        type="button"
                        disabled={!c.match || !onMatchClick}
                        onClick={() => c.match && onMatchClick?.(c.match)}
                        className={`w-14 h-10 rounded font-mono font-bold flex items-center justify-center mx-auto ${c.cls} ${c.match && onMatchClick ? "hover:ring-1 hover:ring-[var(--ikf-gold)]" : ""}`}
                      >
                        {c.text}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!compact && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border-default)]">
              <tr>
                <th className="py-2 px-3">Rank</th><th className="py-2 px-3">Athlete</th><th className="py-2 px-3">Club</th>
                <th className="py-2 px-3 text-center">W</th><th className="py-2 px-3 text-center">D</th><th className="py-2 px-3 text-center">L</th>
                <th className="py-2 px-3 text-center">Pts</th><th className="py-2 px-3 text-center">MP</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.athleteId} className={`border-b border-[rgba(255,255,255,0.04)] ${i === 0 ? "bg-[rgba(212,160,23,0.12)]" : i === 1 ? "bg-[rgba(192,192,192,0.1)]" : ""}`}>
                  <td className="py-2 px-3 font-display text-lg text-white">{i + 1}</td>
                  <td className="py-2 px-3 font-semibold text-white">{s.athleteName}</td>
                  <td className="py-2 px-3 text-[var(--text-secondary)]">{s.clubName}</td>
                  <td className="py-2 px-3 text-center text-[var(--status-win)] font-bold">{s.wins}</td>
                  <td className="py-2 px-3 text-center text-[var(--ikf-gold)]">{s.draws}</td>
                  <td className="py-2 px-3 text-center text-[var(--ikf-red)]">{s.losses}</td>
                  <td className="py-2 px-3 text-center font-mono font-bold text-white">{s.points}</td>
                  <td className="py-2 px-3 text-center text-[var(--text-muted)]">{s.matchesPlayed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RoundRobinGrid;
