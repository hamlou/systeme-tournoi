import { create } from "zustand";

export interface WeighInRecord {
  id: string;
  athleteId: string;
  athleteName: string;
  recordedWeight: number;
  category: string;
  status: "Confirmed" | "Overweight" | "Reassigned";
  timestamp: string;
}

interface WeighInState {
  logs: WeighInRecord[];
  addLog: (log: WeighInRecord) => void;
}

const MOCK_LOGS: WeighInRecord[] = [
  { id: "log-1", athleteId: "3", athleteName: "Jean Dupont", recordedWeight: 78.5, category: "-80kg", status: "Confirmed", timestamp: "2026-06-10T08:15:22Z" },
  { id: "log-2", athleteId: "12", athleteName: "David Kim", recordedWeight: 71.2, category: "-70kg", status: "Overweight", timestamp: "2026-06-10T08:22:10Z" },
  { id: "log-3", athleteId: "15", athleteName: "Elena Rossi", recordedWeight: 54.8, category: "-55kg", status: "Confirmed", timestamp: "2026-06-10T08:35:05Z" },
  { id: "log-4", athleteId: "9", athleteName: "Tariq Aziz", recordedWeight: 44.9, category: "-45kg", status: "Confirmed", timestamp: "2026-06-10T08:42:50Z" },
];

type SetState = (partial: Partial<WeighInState> | ((state: WeighInState) => Partial<WeighInState>)) => void;

export const useWeighinStore = create<WeighInState>((set: SetState) => ({
  logs: MOCK_LOGS,
  addLog: (log) => set((state) => ({ logs: [log, ...state.logs] })),
}));
