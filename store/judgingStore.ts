import { create } from "zustand";
import { MatchReference } from "./roundStore";
import { getSocket } from "@/lib/socketClient";
import toast from "react-hot-toast";

export interface JudgeRoundScore {
  roundNumber: number;
  redScore: number;
  blueScore: number;
  isSubmitted: boolean;
}

export interface JudgeState {
  id: string;
  label: string; // "JUDGE 1"
  scores: JudgeRoundScore[];
}

interface JudgingState {
  activeMatch: MatchReference | null;
  judges: JudgeState[];
  currentRound: number;
  matchStatus: "IN_PROGRESS" | "WAITING_VALIDATION" | "VALIDATED" | "OVERRIDDEN";
  matchWinner: "RED" | "BLUE" | null;
  matchEndReason: string | null;

  initMatch: (match: MatchReference, judgeCount: number) => void;
  setRoundScore: (judgeId: string, roundNumber: number, redScore: number, blueScore: number) => void;
  submitRoundScore: (judgeId: string, roundNumber: number) => void;
  triggerInstantWin: (corner: "RED" | "BLUE", reason: string) => void;
  validateResult: () => void;
  overrideResult: (winner: "RED" | "BLUE", reason: string) => void;
  advanceRound: () => void;
  syncFromRemote: (state: Partial<JudgingState>) => void;
}

const createEmptyJudge = (id: string, label: string): JudgeState => ({
  id,
  label,
  scores: [
    { roundNumber: 1, redScore: 0, blueScore: 0, isSubmitted: false },
    { roundNumber: 2, redScore: 0, blueScore: 0, isSubmitted: false },
    { roundNumber: 3, redScore: 0, blueScore: 0, isSubmitted: false },
  ]
});

// Initial mock data to make it easy to test
const MOCK_MATCH: MatchReference = {
  id: "m7", title: "Match #7", category: "-70kg Senior A", mat: "Mat 01", time: "14:30",
  redCorner: { name: "Ahmed Ben Ali", score: 0 },
  blueCorner: { name: "Karim Mansouri", score: 0 }
};

export const useJudgingStore = create<JudgingState>((set, get) => ({
  activeMatch: MOCK_MATCH,
  judges: [
    createEmptyJudge("j1", "JUDGE 1"),
    createEmptyJudge("j2", "JUDGE 2"),
    createEmptyJudge("j3", "JUDGE 3"),
  ],
  currentRound: 1,
  matchStatus: "IN_PROGRESS",
  matchWinner: null,
  matchEndReason: null,

  initMatch: (match, judgeCount) => {
    const judges = Array.from({ length: judgeCount }).map((_, i) => 
      createEmptyJudge(`j${i+1}`, `JUDGE ${i+1}`)
    );
    set({
      activeMatch: match,
      judges,
      currentRound: 1,
      matchStatus: "IN_PROGRESS",
      matchWinner: null,
      matchEndReason: null,
    });
  },

  setRoundScore: (judgeId, roundNumber, redScore, blueScore) => {
    set((state) => ({
      judges: state.judges.map(j => {
        if (j.id === judgeId) {
          return {
            ...j,
            scores: j.scores.map(s => 
              s.roundNumber === roundNumber && !s.isSubmitted 
                ? { ...s, redScore, blueScore } 
                : s
            )
          };
        }
        return j;
      })
    }));
  },

  submitRoundScore: (judgeId, roundNumber) => {
    set((state) => {
      const judge = state.judges.find(j => j.id === judgeId);
      const nextJudges = state.judges.map(j => {
        if (j.id === judgeId) {
          return {
            ...j,
            scores: j.scores.map(s => 
              s.roundNumber === roundNumber 
                ? { ...s, isSubmitted: true } 
                : s
            )
          };
        }
        return j;
      });
      getSocket()?.emit("judge_score_submitted", { judges: nextJudges });
      toast.success(`${judge?.label ?? "Judge"} — Round ${roundNumber} score submitted`, { icon: "✅" });
      return { judges: nextJudges };
    });
  },

  triggerInstantWin: (corner, reason) => {
    set({
      matchStatus: "WAITING_VALIDATION",
      matchWinner: corner,
      matchEndReason: reason
    });
    getSocket()?.emit("match_validated", { status: "WAITING_VALIDATION", winner: corner, reason });
    toast(`🏆 INSTANT WIN — ${corner} CORNER — ${reason}`, {
      duration: 6000,
      style: { background: corner === "RED" ? "#c8102e" : "#0066cc", color: "#fff", fontWeight: "bold", fontSize: "14px" }
    });
  },

  validateResult: () => {
    set({ matchStatus: "VALIDATED" });
    const state = get();
    getSocket()?.emit("match_validated", { status: "VALIDATED", winner: state.matchWinner, reason: state.matchEndReason });
    toast.success(`Result VALIDATED — ${state.matchWinner} CORNER WINS`, { duration: 5000 });
  },

  overrideResult: (winner, reason) => {
    set({
      matchStatus: "OVERRIDDEN",
      matchWinner: winner,
      matchEndReason: `Overridden: ${reason}`
    });
    getSocket()?.emit("match_validated", { status: "OVERRIDDEN", winner, reason: `Overridden: ${reason}` });
    toast(`⚠️ Result OVERRIDDEN by Chief Referee — ${winner} CORNER`, { duration: 5000, icon: "⚖️" });
  },

  advanceRound: () => {
    set(state => ({ currentRound: state.currentRound + 1 }));
  },

  syncFromRemote: (newState) => {
    set(newState);
  }
}));
