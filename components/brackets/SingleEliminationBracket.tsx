"use client";

import React from "react";
import { Trophy } from "lucide-react";
import type { Match } from "@/types/tournament";
import { MatchBox } from "./MatchBox";
import { roundNamesForSize, nextPowerOfTwo } from "@/lib/bracketGenerators";

export function SingleEliminationBracket({ matches, onMatchClick }: { matches: Match[]; onMatchClick: (m: Match) => void }) {
  const winners = matches.filter(m => m.bracketType !== "losers" && m.bracketType !== "grand-final");
  const firstRoundCount = winners.filter(m => m.round === (roundNamesForSize(nextPowerOfTwo(winners.length + 1))[0])).length;
  // Derive ordered round names present in the data.
  const roundOrder = Array.from(new Set(winners.map(m => m.round)));
  const finalMatch = winners.find(m => m.round === "Final");
  const champion = finalMatch?.result ? finalMatch.result.winnerName : null;

  return (
    <div className="p-8 overflow-x-auto">
      <div className="flex gap-[60px] items-center min-w-max">
        {roundOrder.map(roundName => {
          const roundMatches = winners.filter(m => m.round === roundName);
          return (
            <div key={roundName} className="flex flex-col gap-6 justify-center">
              <div className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase text-center mb-2">{roundName}</div>
              {roundMatches.map(m => <MatchBox key={m.id} match={m} onClick={onMatchClick} />)}
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
