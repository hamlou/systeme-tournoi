import { create } from "zustand";

interface NavigationState {
  activePage: string;
  setActivePage: (page: string) => void;
}

type SetState = (partial: Partial<NavigationState> | ((state: NavigationState) => Partial<NavigationState>)) => void;

export const useNavigationStore = create<NavigationState>((set: SetState) => ({
  activePage: "Dashboard",
  setActivePage: (page) => set({ activePage: page }),
}));
