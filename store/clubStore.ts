import { create } from "zustand";

export interface Club {
  id: string;
  name: string;
  country: string;
  presidentName: string;
  email: string;
  phone: string;
  affiliationNumber: string;
  expectedAthletes: number;
  status: "Active" | "Incomplete" | "Suspended";
  logoUrl?: string;
  notes?: string;
  // Mock stats
  registeredAthletes: number;
  confirmedAthletes: number;
  pendingAthletes: number;
}

interface ClubState {
  clubs: Club[];
  addClub: (club: Club) => void;
}

const MOCK_CLUBS: Club[] = [
  { id: "1", name: "Tunis Fight Club", country: "Tunisia 🇹🇳", presidentName: "Ahmed Trabelsi", email: "contact@tunisfightclub.tn", phone: "+216 20 123 456", affiliationNumber: "IKF-TN-001", expectedAthletes: 15, status: "Active", registeredAthletes: 12, confirmedAthletes: 8, pendingAthletes: 4 },
  { id: "2", name: "Algiers Strikers", country: "Algeria 🇩🇿", presidentName: "Karim Bouazizi", email: "info@algiers-strikers.dz", phone: "+213 55 987 654", affiliationNumber: "IKF-DZ-042", expectedAthletes: 10, status: "Active", registeredAthletes: 10, confirmedAthletes: 10, pendingAthletes: 0 },
  { id: "3", name: "Paris Kenshido", country: "France 🇫🇷", presidentName: "Marc Laurent", email: "bureau@pariskenshido.fr", phone: "+33 6 12 34 56 78", affiliationNumber: "IKF-FR-105", expectedAthletes: 8, status: "Active", registeredAthletes: 8, confirmedAthletes: 5, pendingAthletes: 3 },
  { id: "4", name: "Rabat Warriors", country: "Morocco 🇲🇦", presidentName: "Yassine Bounou", email: "admin@rabatwarriors.ma", phone: "+212 6 00 11 22 33", affiliationNumber: "IKF-MA-019", expectedAthletes: 20, status: "Incomplete", registeredAthletes: 15, confirmedAthletes: 5, pendingAthletes: 10 },
  { id: "5", name: "Cairo Martial Arts", country: "Egypt 🇪🇬", presidentName: "Mahmoud Hassan", email: "info@cairomartialarts.eg", phone: "+20 10 1234 5678", affiliationNumber: "IKF-EG-088", expectedAthletes: 12, status: "Active", registeredAthletes: 12, confirmedAthletes: 12, pendingAthletes: 0 },
  { id: "6", name: "Rio Kenshido", country: "Brazil 🇧🇷", presidentName: "Carlos Silva", email: "contato@riokenshido.br", phone: "+55 21 98765-4321", affiliationNumber: "IKF-BR-204", expectedAthletes: 5, status: "Active", registeredAthletes: 5, confirmedAthletes: 2, pendingAthletes: 3 },
  { id: "7", name: "Dakar Strikers", country: "Senegal 🇸🇳", presidentName: "Mamadou Ndiaye", email: "hello@dakarstrikers.sn", phone: "+221 77 123 45 67", affiliationNumber: "IKF-SN-033", expectedAthletes: 6, status: "Suspended", registeredAthletes: 6, confirmedAthletes: 0, pendingAthletes: 6 },
  { id: "8", name: "NY Martial Arts", country: "USA 🇺🇸", presidentName: "David Johnson", email: "info@nymartialarts.com", phone: "+1 212-555-0198", affiliationNumber: "IKF-US-551", expectedAthletes: 10, status: "Active", registeredAthletes: 8, confirmedAthletes: 8, pendingAthletes: 0 },
];

type SetState = (partial: Partial<ClubState> | ((state: ClubState) => Partial<ClubState>)) => void;

export const useClubStore = create<ClubState>((set: SetState) => ({
  clubs: MOCK_CLUBS,
  addClub: (club) => set((state) => ({ clubs: [club, ...state.clubs] })),
}));
