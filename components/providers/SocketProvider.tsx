/* eslint-disable */
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useTournamentStore } from "@/store/tournamentStore";
import { initSocket } from "@/lib/socketClient";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    initSocket().then((socketInstance) => {
      setSocket(socketInstance);
      
      if (socketInstance.connected) setIsConnected(true);

      socketInstance.on("connect", () => {
        setIsConnected(true);
      });

      socketInstance.on("disconnect", () => {
        setIsConnected(false);
      });

      socketInstance.on("connect_error", () => {
        setIsConnected(false);
      });

      socketInstance.on("receive-event", (obj: any) => {
        if (!obj || !obj.type || !obj.data) return;

        const store = useTournamentStore.getState();

        switch (obj.type) {
          case "judge_score_submitted":
            store.setJudgeScore(obj.data.score);
            break;
          case "match_state":
            useTournamentStore.setState((s) => ({
              activeMatch: obj.data.activeMatch ?? s.activeMatch,
              currentRound: obj.data.currentRound ?? s.currentRound,
              roundTimer: obj.data.roundTimer ?? s.roundTimer,
              timerMode: obj.data.timerMode ?? s.timerMode,
              roundEvents: obj.data.roundEvents ?? s.roundEvents,
              currentResult: obj.data.currentResult ?? s.currentResult,
            }));
            break;
          case "match_updated":
            if (obj.data.match) {
              useTournamentStore.setState((s) => ({
                matches: s.matches.map(m => m.id === obj.data.match.id ? obj.data.match : m),
                activeMatch: s.activeMatch?.id === obj.data.match.id ? obj.data.match : s.activeMatch,
              }));
            }
            break;
          case "timer_update":
            if (obj.data.activeMatch) useTournamentStore.setState({ activeMatch: obj.data.activeMatch });
            if (obj.data.currentRound !== undefined) useTournamentStore.setState({ currentRound: obj.data.currentRound });
            if (obj.data.roundTimer !== undefined) {
              useTournamentStore.setState({ roundTimer: obj.data.roundTimer });
            }
            if (obj.data.timerMode !== undefined) {
              useTournamentStore.setState({ timerMode: obj.data.timerMode });
            }
            break;
          case "round_event_added":
            useTournamentStore.setState((s) => ({
              roundEvents: [...s.roundEvents, obj.data.event]
            }));
            break;
          case "result_validated":
          case "result_overridden":
            useTournamentStore.setState({ currentResult: obj.data.result });
            if (obj.data.result && store.activeMatch) {
              store.updateMatchResult(store.activeMatch.id, obj.data.result);
            }
            break;
        }
      });
    });
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

