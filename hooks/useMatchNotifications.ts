"use client";

import { useEffect, useMemo, useState } from "react";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Match } from "@/types/tournament";

const WARNING_WINDOW_MS = 4 * 60 * 1000;

export function getMatchTimeRemaining(match: Match) {
  if (!match.scheduledTime) return null;
  const diff = new Date(match.scheduledTime).getTime() - Date.now();
  if (diff <= 0) return "00:00";
  const totalSeconds = Math.ceil(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function isMatchStartingSoon(match: Match, now = Date.now()) {
  if (match.status !== "scheduled" || !match.scheduledTime) return false;
  const diff = new Date(match.scheduledTime).getTime() - now;
  return diff > 0 && diff <= WARNING_WINDOW_MS;
}

export function useMatchNotifications() {
  const matches = useTournamentStore(s => s.matches);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  return useMemo(
    () => matches.filter(match => isMatchStartingSoon(match, now)).sort((a, b) => new Date(a.scheduledTime ?? 0).getTime() - new Date(b.scheduledTime ?? 0).getTime()),
    [matches, now]
  );
}
