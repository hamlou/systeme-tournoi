"use client";

import React from "react";
import { Trophy } from "lucide-react";
import type { Match } from "@/types/tournament";
import { MatchBox } from "./MatchBox";

export function SingleEliminationBracket({ matches, onMatchClick }: { matches: Match[]; onMatchClick: (m: Match) => void }) {
  const winners = matches.filter(m => m.bracketType !== "losers" && m.bracketType !== "grand-final");
  // Derive ordered round names present in the data.
  const roundOrder = Array.from(new Set(winners.map(m => m.round)));
  const finalMatch = winners.find(m => m.round === "Final");
  const champion = finalMatch?.result ? finalMatch.result.winnerName : null;

  return (
    <div className="p-8 overflow-x-auto">
      <div className="flex gap-[72px] items-center min-w-max">
        {roundOrder.map((roundName, roundIndex) => {
          const roundMatches = winners.filter(m => m.round === roundName);
          const hasNextRound = roundIndex < roundOrder.length - 1;
          return (
            <div key={roundName} className="flex flex-col gap-8 justify-center">
              <div className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase text-center mb-2">{roundName}</div>
              {roundMatches.map((m, matchIndex) => (
                <div key={m.id} className="relative">
                  <MatchBox match={m} onClick={onMatchClick} />
                  {hasNextRound && (
                    <>
                      <div className="absolute left-full top-1/2 h-px w-[72px] -translate-y-1/2 bg-[linear-gradient(90deg,rgba(212,160,23,0.85),rgba(212,160,23,0.18))]" />
                      <div className={`absolute left-[calc(100%+72px)] h-[calc(50%+16px)] w-px bg-[rgba(212,160,23,0.34)] ${matchIndex % 2 === 0 ? "top-1/2" : "bottom-1/2"}`} />
                      <div className="absolute left-[calc(100%+64px)] top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border border-[var(--ikf-gold)] bg-[var(--bg-primary)] shadow-[0_0_12px_rgba(212,160,23,0.45)]" />
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        <div className="flex flex-col justify-center w-[200px] ml-6">
          <div className={`p-6 border-2 rounded-xl text-center transition-all ${champion ? "border-[var(--ikf-gold)] bg-[rgba(212,160,23,0.1)] shadow-[var(--shadow-gold-glow)]" : "border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)]"}`}>
            <Trophy size={48} className={`mx-auto mb-4 ${champion ? "text-[var(--ikf-gold)]" : "text-[var(--border-default)]"}`} />
            <div className="text-xs font-bold text-[var(--text-muted)] tracking-widest uppercase mb-2">Champion</div>
            <div className={`font-display text-3xl leading-none ${champion ? "text-white" : "text-[var(--text-muted)]"}`}>{champion ?? "TBD"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SingleEliminationBracket;
