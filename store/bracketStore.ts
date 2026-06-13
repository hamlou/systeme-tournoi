import { create } from "zustand";

export interface MatchAthlete {
  id: string;
  name: string;
  score?: number;
}

export interface Match {
  id: string;
  matchNumber: number;
  round: string; // "Quarterfinal", "Semifinal", "Final", "Round 1"
  mat: string;
  time: string;
  status: "SCHEDULED" | "IN PROGRESS" | "COMPLETED";
  redCorner: MatchAthlete | null;
  blueCorner: MatchAthlete | null;
  winnerId?: string;
}

export interface Bracket {
  id: string;
  categoryId: string; // e.g. "-70kg Senior A"
  format: "Single Elimination" | "Double Elimination" | "Round Robin" | "Pool + Elimination";
  matches: Match[];
}

interface BracketState {
  brackets: Bracket[];
  generateBracket: (categoryId: string, format: string) => void;
  reorderMatches: (categoryId: string, newMatches: Match[]) => void;
}

const MOCK_BRACKETS: Bracket[] = [
  {
    id: "br-1",
    categoryId: "-70kg Senior A",
    format: "Single Elimination",
    matches: [
      { id: "m1", matchNumber: 1, round: "Quarterfinal", mat: "Mat 01", time: "10:00", status: "COMPLETED", redCorner: { id: "a1", name: "Youssef Ben Ali", score: 5 }, blueCorner: { id: "a2", name: "Marc Laurent", score: 2 }, winnerId: "a1" },
      { id: "m2", matchNumber: 2, round: "Quarterfinal", mat: "Mat 01", time: "10:15", status: "COMPLETED", redCorner: { id: "a3", name: "Karim Bouazizi", score: 0 }, blueCorner: { id: "a4", name: "Lucas Silva", score: 8 }, winnerId: "a4" },
      { id: "m3", matchNumber: 3, round: "Quarterfinal", mat: "Mat 02", time: "10:00", status: "SCHEDULED", redCorner: { id: "a5", name: "David Kim" }, blueCorner: { id: "a6", name: "Omar Diallo" } },
      { id: "m4", matchNumber: 4, round: "Quarterfinal", mat: "Mat 02", time: "10:15", status: "SCHEDULED", redCorner: { id: "a7", name: "Ahmed Hassan" }, blueCorner: { id: "a8", name: "Tariq Aziz" } },
      { id: "m5", matchNumber: 5, round: "Semifinal", mat: "Mat 01", time: "11:30", status: "SCHEDULED", redCorner: { id: "a1", name: "Youssef Ben Ali" }, blueCorner: { id: "a4", name: "Lucas Silva" } },
      { id: "m6", matchNumber: 6, round: "Semifinal", mat: "Mat 02", time: "11:30", status: "SCHEDULED", redCorner: null, blueCorner: null },
      { id: "m7", matchNumber: 7, round: "Final", mat: "Mat 01", time: "14:00", status: "SCHEDULED", redCorner: null, blueCorner: null },
    ]
  },
  {
    id: "br-2",
    categoryId: "-60kg U18",
    format: "Round Robin",
    matches: [
      { id: "r1", matchNumber: 1, round: "Round 1", mat: "Mat 03", time: "09:00", status: "COMPLETED", redCorner: { id: "b1", name: "Ali Ahmed", score: 10 }, blueCorner: { id: "b2", name: "Sami Z.", score: 5 }, winnerId: "b1" },
      { id: "r2", matchNumber: 2, round: "Round 1", mat: "Mat 03", time: "09:15", status: "COMPLETED", redCorner: { id: "b3", name: "Omar H.", score: 2 }, blueCorner: { id: "b4", name: "Zaid T.", score: 2 } }, // Draw
      { id: "r3", matchNumber: 3, round: "Round 2", mat: "Mat 03", time: "10:00", status: "SCHEDULED", redCorner: { id: "b1", name: "Ali Ahmed" }, blueCorner: { id: "b3", name: "Omar H." } },
      { id: "r4", matchNumber: 4, round: "Round 2", mat: "Mat 03", time: "10:15", status: "SCHEDULED", redCorner: { id: "b2", name: "Sami Z." }, blueCorner: { id: "b4", name: "Zaid T." } },
      { id: "r5", matchNumber: 5, round: "Round 3", mat: "Mat 03", time: "11:00", status: "SCHEDULED", redCorner: { id: "b1", name: "Ali Ahmed" }, blueCorner: { id: "b4", name: "Zaid T." } },
      { id: "r6", matchNumber: 6, round: "Round 3", mat: "Mat 03", time: "11:15", status: "SCHEDULED", redCorner: { id: "b2", name: "Sami Z." }, blueCorner: { id: "b3", name: "Omar H." } },
    ]
  },
  {
    id: "br-3",
    categoryId: "-80kg Senior A",
    format: "Single Elimination",
    matches: [
      { id: "x1", matchNumber: 1, round: "Quarterfinal", mat: "Mat 01", time: "15:00", status: "SCHEDULED", redCorner: { id: "c1", name: "Fighter 1" }, blueCorner: { id: "c2", name: "Fighter 2" } },
      { id: "x2", matchNumber: 2, round: "Quarterfinal", mat: "Mat 01", time: "15:15", status: "SCHEDULED", redCorner: { id: "c3", name: "Fighter 3" }, blueCorner: { id: "c4", name: "Fighter 4" } },
      { id: "x3", matchNumber: 3, round: "Quarterfinal", mat: "Mat 02", time: "15:00", status: "SCHEDULED", redCorner: { id: "c5", name: "Fighter 5" }, blueCorner: { id: "c6", name: "Fighter 6" } },
      { id: "x4", matchNumber: 4, round: "Quarterfinal", mat: "Mat 02", time: "15:15", status: "SCHEDULED", redCorner: { id: "c7", name: "Fighter 7" }, blueCorner: { id: "c8", name: "Fighter 8" } },
      { id: "x5", matchNumber: 5, round: "Semifinal", mat: "Mat 01", time: "16:30", status: "SCHEDULED", redCorner: null, blueCorner: null },
      { id: "x6", matchNumber: 6, round: "Semifinal", mat: "Mat 02", time: "16:30", status: "SCHEDULED", redCorner: null, blueCorner: null },
      { id: "x7", matchNumber: 7, round: "Final", mat: "Mat 01", time: "18:00", status: "SCHEDULED", redCorner: null, blueCorner: null },
    ]
  }
];

export const useBracketStore = create<BracketState>((set) => ({
  brackets: MOCK_BRACKETS,
  generateBracket: (categoryId, format) => {
    console.log("Generating bracket for", categoryId, format);
  },
  reorderMatches: (categoryId, newMatches) => set((state) => ({
    brackets: state.brackets.map(b => b.categoryId === categoryId ? { ...b, matches: newMatches } : b)
  })),
}));
