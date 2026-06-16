import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

export type TimerStatus = "IDLE" | "RUNNING" | "PAUSED" | "REST" | "MEDICAL" | "WOSK";

export interface LogEntry {
  id: string;
  matchId: string;
  timestamp: string;
  message: string;
}

export interface MatchReference {
  id: string;
  title: string;
  category: string;
  mat: string;
  time: string;
  redCorner: { name: string; score: number };
  blueCorner: { name: string; score: number };
}

interface RoundState {
  activeMatch: MatchReference | null;
  status: TimerStatus;
  timeLeft: number;
  maxTime: number;
  currentRound: number;
  maxRounds: number;
  woskTimeLeft: number;
  woskCorner: "RED" | "BLUE" | null;
  restTimeLeft: number;
  logs: LogEntry[];
  
  selectMatch: (match: MatchReference, defaultMaxTime: number, maxRounds: number) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  stopMatch: () => void;
  triggerWosk: (corner: "RED" | "BLUE") => void;
  triggerMedical: () => void;
  endRound: () => void;
  tick: () => void;
  addLog: (message: string) => void;
  syncFromRemote: (state: Partial<RoundState>) => void;
}

const emitTimerUpdate = (_state: unknown) => {
  // Socket.IO removed — timer sync is handled by Firebase in rounds/page.tsx
};

const emitMatchEvent = (_message: string) => {
  // Socket.IO removed — event sync is handled by Firebase in tournamentStore
};

type SetState = (partial: Partial<RoundState> | ((state: RoundState) => Partial<RoundState>)) => void;
type GetState = () => RoundState;

export const useRoundStore = create<RoundState>((set: SetState, get: GetState) => ({
  activeMatch: null,
  status: "IDLE",
  timeLeft: 0,
  maxTime: 180,
  currentRound: 1,
  maxRounds: 3,
  woskTimeLeft: 0,
  woskCorner: null,
  restTimeLeft: 0,
  logs: [],

  addLog: (message: string) => {
    const { activeMatch } = get();
    if (!activeMatch) return;
    const newLog = {
      id: uuidv4(),
      matchId: activeMatch.id,
      timestamp: new Date().toISOString(),
      message,
    };
    set((state) => ({ logs: [newLog, ...state.logs] }));
    emitMatchEvent(message);
  },

  selectMatch: (match, defaultMaxTime, maxRounds) => {
    set({
      activeMatch: match,
      status: "IDLE",
      timeLeft: defaultMaxTime,
      maxTime: defaultMaxTime,
      currentRound: 1,
      maxRounds,
      woskTimeLeft: 0,
      woskCorner: null,
      restTimeLeft: 0,
    });
    get().addLog("Match Loaded into Timer");
    emitTimerUpdate(get());
  },

  startTimer: () => {
    set({ status: "RUNNING", woskTimeLeft: 0, woskCorner: null });
    get().addLog(`Round ${get().currentRound} Started/Resumed`);
    emitTimerUpdate({ status: "RUNNING" });
  },

  pauseTimer: () => {
    set({ status: "PAUSED" });
    get().addLog("Timer Paused");
    emitTimerUpdate({ status: "PAUSED" });
  },

  stopMatch: () => {
    set({ status: "IDLE", timeLeft: get().maxTime });
    get().addLog("Match Stopped by Official");
    emitTimerUpdate({ status: "IDLE", timeLeft: get().maxTime });
  },

  triggerWosk: (corner) => {
    set({ status: "WOSK", woskTimeLeft: 10, woskCorner: corner });
    get().addLog(`WOSK STOP (${corner === "RED" ? "Red" : "Blue"} Corner — Passivity)`);
    emitTimerUpdate({ status: "WOSK", woskTimeLeft: 10, woskCorner: corner });
  },

  triggerMedical: () => {
    set({ status: "MEDICAL" });
    get().addLog("MEDICAL TIMEOUT — Timer Frozen");
    emitTimerUpdate({ status: "MEDICAL" });
  },

  endRound: () => {
    const { currentRound, maxRounds } = get();
    get().addLog(`Round ${currentRound} Ended`);
    if (currentRound < maxRounds) {
      set({ status: "REST", restTimeLeft: 60 });
      get().addLog("REST Period Started (1:00)");
      emitTimerUpdate({ status: "REST", restTimeLeft: 60 });
    } else {
      set({ status: "IDLE" });
      get().addLog("Match Concluded");
      emitTimerUpdate({ status: "IDLE" });
    }
  },

  tick: () => {
    const state = get();
    if (state.status === "RUNNING") {
      if (state.timeLeft > 0) {
        set({ timeLeft: state.timeLeft - 1 });
        // Emit roughly every tick so TV syncs (can optimize in prod, but fine for now)
        emitTimerUpdate({ timeLeft: state.timeLeft - 1 });
      } else {
        state.endRound();
      }
    } else if (state.status === "WOSK") {
      if (state.woskTimeLeft > 0) {
        set({ woskTimeLeft: state.woskTimeLeft - 1 });
        emitTimerUpdate({ woskTimeLeft: state.woskTimeLeft - 1 });
      } else {
        set({ status: "RUNNING", woskCorner: null });
        get().addLog("WOSK Countdown Ended — Main Timer Resumed");
        emitTimerUpdate({ status: "RUNNING", woskCorner: null });
      }
    } else if (state.status === "REST") {
      if (state.restTimeLeft > 0) {
        set({ restTimeLeft: state.restTimeLeft - 1 });
        emitTimerUpdate({ restTimeLeft: state.restTimeLeft - 1 });
      } else {
        set({ 
          status: "IDLE", 
          currentRound: state.currentRound + 1,
          timeLeft: state.maxTime
        });
        get().addLog(`Round ${state.currentRound + 1} Ready`);
        emitTimerUpdate({ status: "IDLE", currentRound: state.currentRound + 1, timeLeft: state.maxTime });
      }
    }
  },

  syncFromRemote: (newState) => {
    set(newState);
  }
}));
