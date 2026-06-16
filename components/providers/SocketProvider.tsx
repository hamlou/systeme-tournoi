"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onValue, off, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { useTournamentStore } from "@/store/tournamentStore";
import type { Athlete, Club, WeighinRecord, Match, Bracket, Referee, JudgeScore, RoundEvent, TournamentReport, TournamentSettings } from "@/types/tournament";

interface SyncContextType {
  isConnected: boolean;
}

const SyncContext = createContext<SyncContextType>({ isConnected: false });

export const useSocket = () => useContext(SyncContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const rootRef = ref(db, "tournament");
    let connected = false;

    const handler = (snapshot: { val: () => Record<string, unknown> | null }) => {
      const data = snapshot.val();
      if (!data) return;
      if (!connected) { connected = true; setIsConnected(true); }

      const store = useTournamentStore;

      // Sync each collection into the Zustand store
      if (data.settings) {
        store.setState({ settings: data.settings as TournamentSettings });
      }
      if (Array.isArray(data.athletes)) {
        store.setState({ athletes: data.athletes as Athlete[] });
      }
      if (Array.isArray(data.clubs)) {
        store.setState({ clubs: data.clubs as Club[] });
      }
      if (Array.isArray(data.weighinRecords)) {
        store.setState({ weighinRecords: data.weighinRecords as WeighinRecord[] });
      }
      if (Array.isArray(data.matches)) {
        store.setState({ matches: (data.matches as Match[]).map(match => ({ ...match, totalRounds: 3 })) });
      }
      if (Array.isArray(data.brackets)) {
        store.setState({ brackets: data.brackets as Bracket[] });
      }
      if (Array.isArray(data.referees)) {
        store.setState({ referees: data.referees as Referee[] });
      }
      if (Array.isArray(data.judgeScores)) {
        store.setState({ judgeScores: data.judgeScores as JudgeScore[] });
      }
      if (data.events) {
        const events = Array.isArray(data.events)
          ? data.events
          : Object.values(data.events as Record<string, RoundEvent>);
        store.setState({ roundEvents: events as RoundEvent[] });
      }
      if (Array.isArray(data.reports)) {
        store.setState({ reports: data.reports as TournamentReport[] });
      }
      if (data.activeMatch) {
        store.setState({ activeMatch: { ...(data.activeMatch as Match), totalRounds: 3 } });
      }
    };

    onValue(rootRef, handler);
    return () => { off(rootRef, "value", handler); };
  }, []);

  return (
    <SyncContext.Provider value={{ isConnected }}>
      {children}
    </SyncContext.Provider>
  );
};
