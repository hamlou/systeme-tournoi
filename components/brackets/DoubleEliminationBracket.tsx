"use client";

import React from "react";
import type { Match, Bracket } from "@/types/tournament";
import { MatchBox } from "./MatchBox";

function RoundColumns({ matches, onMatchClick }: { matches: Match[]; onMatchClick: (m: Match) => void }) {
  const roundOrder = Array.from(new Set(matches.map(m => m.round)));
  return (
    <div className="flex gap-[50px] items-center min-w-max">
      {roundOrder.map(roundName => (
        <div key={roundName} className="flex flex-col gap-5 justify-center">
          <div className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase text-center mb-1">{roundName}</div>
          {matches.filter(m => m.round === roundName).map(m => (
            <div key={m.id} className="relative">
              <MatchBox match={m} onClick={onMatchClick} compact />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function DoubleEliminationBracket({ bracket, matches, onMatchClick }: { bracket: Bracket; matches: Match[]; onMatchClick: (m: Match) => void }) {
  const winners = matches.filter(m => m.bracketType === "winners");
  const losers = matches.filter(m => m.bracketType === "losers");
  const grandFinal = matches.find(m => m.bracketType === "grand-final");

  return (
    <div className="p-8 space-y-10 overflow-x-auto">
      <div>
        <div className="font-display text-2xl text-[var(--ikf-gold)] tracking-widest mb-1">WINNERS BRACKET</div>
        <div className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {bracket.ageGroup ?? bracket.category} {bracket.weightCategory ? `- ${bracket.weightCategory}` : ""}
        </div>
        <RoundColumns matches={winners} onMatchClick={onMatchClick} />
      </div>

      <div>
        <div className="font-display text-2xl text-[var(--ikf-red)] tracking-widest mb-4 flex items-center gap-3">
          LOSERS BRACKET
          <span className="text-[10px] font-bold bg-[rgba(200,16,46,0.15)] text-[var(--ikf-red)] border border-[var(--ikf-red)] rounded px-2 py-0.5 tracking-widest">L1 = 1 loss</span>
        </div>
        {losers.length > 0 ? <RoundColumns matches={losers} onMatchClick={onMatchClick} /> : <div className="text-[var(--text-muted)] text-sm">No losers-bracket matches yet.</div>}
      </div>

      {grandFinal && (
        <div>
          <div className="font-display text-2xl text-white tracking-widest mb-4">GRAND FINAL</div>
          <MatchBox match={grandFinal} onClick={onMatchClick} />
        </div>
      )}
    </div>
  );
}

export default DoubleEliminationBracket;
