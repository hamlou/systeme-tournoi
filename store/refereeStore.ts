import { create } from "zustand";

export interface Referee {
  id: string;
  name: string;
  role: "Chief Referee" | "Central Referee" | "Corner Judge";
  country: string;
  grade: string;
  status: "Available" | "In Match" | "On Break";
  currentAssignment?: string;
}

interface RefereeState {
  referees: Referee[];
  addReferee: (referee: Referee) => void;
  updateRefereeStatus: (id: string, status: Referee["status"], assignment?: string) => void;
}

const MOCK_REFEREES: Referee[] = [
  { id: "ref-1", name: "Yoshiro Nakamura", role: "Chief Referee", country: "Japan 🇯🇵", grade: "IKF Grade S", status: "Available" },
  { id: "ref-2", name: "Sarah Collins", role: "Central Referee", country: "USA 🇺🇸", grade: "IKF Grade A", status: "In Match", currentAssignment: "Assigned to Mat 01 — Match #14" },
  { id: "ref-3", name: "Ahmed Mansour", role: "Central Referee", country: "Egypt 🇪🇬", grade: "IKF Grade A", status: "Available" },
  { id: "ref-4", name: "Elena Volkov", role: "Central Referee", country: "Russia 🇷🇺", grade: "IKF Grade B", status: "On Break" },
  { id: "ref-5", name: "Carlos Mendez", role: "Corner Judge", country: "Spain 🇪🇸", grade: "IKF Grade B", status: "In Match", currentAssignment: "Assigned to Mat 01 — Match #14" },
  { id: "ref-6", name: "Lucas Costa", role: "Corner Judge", country: "Brazil 🇧🇷", grade: "IKF Grade B", status: "Available" },
  { id: "ref-7", name: "Amina Diallo", role: "Corner Judge", country: "Senegal 🇸🇳", grade: "IKF Grade C", status: "Available" },
  { id: "ref-8", name: "Chen Wei", role: "Corner Judge", country: "China 🇨🇳", grade: "IKF Grade A", status: "In Match", currentAssignment: "Assigned to Mat 01 — Match #14" },
  { id: "ref-9", name: "David Smith", role: "Corner Judge", country: "UK 🇬🇧", grade: "IKF Grade C", status: "On Break" },
  { id: "ref-10", name: "Maria Garcia", role: "Corner Judge", country: "Mexico 🇲🇽", grade: "IKF Grade B", status: "Available" },
];

export const useRefereeStore = create<RefereeState>((set) => ({
  referees: MOCK_REFEREES,
  addReferee: (referee) => set((state) => ({ referees: [referee, ...state.referees] })),
  updateRefereeStatus: (id, status, assignment) => set((state) => ({
    referees: state.referees.map(r => r.id === id ? { ...r, status, currentAssignment: assignment } : r)
  }))
}));
