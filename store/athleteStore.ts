import { create } from "zustand";

export interface Athlete {
  id: string;
  licenseNumber: string;
  fullName: string;
  dob: string;
  gender: "Male" | "Female";
  country: string;
  nationalId: string;
  club: string;
  weightCategory: string;
  ageGroup: string;
  licenseType: "Annual" | "Tournament";
  medicalClearance: boolean;
  weighInStatus: "Pending" | "Confirmed" | "Overweight";
  registrationStatus: "Active" | "Withdrawn" | "Suspended";
  photoUrl?: string;
}

interface AthleteState {
  athletes: Athlete[];
  addAthlete: (athlete: Athlete) => void;
  updateAthlete: (id: string, data: Partial<Athlete>) => void;
}

const MOCK_ATHLETES: Athlete[] = [
  { id: "1", licenseNumber: "IKF-26-0001", fullName: "Youssef Ben Ali", dob: "1998-05-12", gender: "Male", country: "Tunisia 🇹🇳", nationalId: "TN123456", club: "Tunis Fight Club", weightCategory: "-70kg", ageGroup: "Senior A", licenseType: "Annual", medicalClearance: true, weighInStatus: "Confirmed", registrationStatus: "Active" },
  { id: "2", licenseNumber: "IKF-26-0002", fullName: "Amira Kaddour", dob: "2001-08-22", gender: "Female", country: "Algeria 🇩🇿", nationalId: "DZ987654", club: "Algiers Strikers", weightCategory: "-60kg", ageGroup: "Senior B", licenseType: "Annual", medicalClearance: true, weighInStatus: "Pending", registrationStatus: "Active" },
  { id: "3", licenseNumber: "IKF-26-0003", fullName: "Jean Dupont", dob: "1995-11-03", gender: "Male", country: "France 🇫🇷", nationalId: "FR456123", club: "Paris Kenshido", weightCategory: "-80kg", ageGroup: "Senior A", licenseType: "Tournament", medicalClearance: true, weighInStatus: "Confirmed", registrationStatus: "Active" },
  { id: "4", licenseNumber: "IKF-26-0004", fullName: "Karim Ziyech", dob: "2000-01-15", gender: "Male", country: "Morocco 🇲🇦", nationalId: "MA789456", club: "Rabat Warriors", weightCategory: "-65kg", ageGroup: "Senior A", licenseType: "Annual", medicalClearance: true, weighInStatus: "Overweight", registrationStatus: "Suspended" },
  { id: "5", licenseNumber: "IKF-26-0005", fullName: "Ahmed Hassan", dob: "2005-04-09", gender: "Male", country: "Egypt 🇪🇬", nationalId: "EG321654", club: "Cairo Martial Arts", weightCategory: "-75kg", ageGroup: "Senior C", licenseType: "Tournament", medicalClearance: true, weighInStatus: "Pending", registrationStatus: "Active" },
  { id: "6", licenseNumber: "IKF-26-0006", fullName: "Sophie Martin", dob: "2008-09-30", gender: "Female", country: "France 🇫🇷", nationalId: "FR159357", club: "Lyon Fight Gym", weightCategory: "-55kg", ageGroup: "U18", licenseType: "Annual", medicalClearance: true, weighInStatus: "Confirmed", registrationStatus: "Active" },
  { id: "7", licenseNumber: "IKF-26-0007", fullName: "Mehdi Taremi", dob: "1999-07-18", gender: "Male", country: "Tunisia 🇹🇳", nationalId: "TN852963", club: "Sfax Defenders", weightCategory: "-85kg", ageGroup: "Senior B", licenseType: "Annual", medicalClearance: true, weighInStatus: "Confirmed", registrationStatus: "Active" },
  { id: "8", licenseNumber: "IKF-26-0008", fullName: "Fatima Zahra", dob: "2003-12-05", gender: "Female", country: "Morocco 🇲🇦", nationalId: "MA741852", club: "Casablanca Elite", weightCategory: "-50kg", ageGroup: "Senior A", licenseType: "Tournament", medicalClearance: true, weighInStatus: "Pending", registrationStatus: "Withdrawn" },
  { id: "9", licenseNumber: "IKF-26-0009", fullName: "Tariq Aziz", dob: "2010-02-14", gender: "Male", country: "Algeria 🇩🇿", nationalId: "DZ369258", club: "Oran Combat", weightCategory: "-45kg", ageGroup: "U16", licenseType: "Annual", medicalClearance: true, weighInStatus: "Confirmed", registrationStatus: "Active" },
  { id: "10", licenseNumber: "IKF-26-0010", fullName: "Lucas Silva", dob: "1997-06-25", gender: "Male", country: "Brazil 🇧🇷", nationalId: "BR147258", club: "Rio Kenshido", weightCategory: "-90kg", ageGroup: "Senior A", licenseType: "Annual", medicalClearance: true, weighInStatus: "Confirmed", registrationStatus: "Active" },
  { id: "11", licenseNumber: "IKF-26-0011", fullName: "Aya Mahmoud", dob: "2006-03-10", gender: "Female", country: "Egypt 🇪🇬", nationalId: "EG258369", club: "Alexandria Club", weightCategory: "-65kg", ageGroup: "U18", licenseType: "Annual", medicalClearance: true, weighInStatus: "Pending", registrationStatus: "Active" },
  { id: "12", licenseNumber: "IKF-26-0012", fullName: "David Kim", dob: "2002-10-19", gender: "Male", country: "USA 🇺🇸", nationalId: "US963852", club: "NY Martial Arts", weightCategory: "-70kg", ageGroup: "Senior B", licenseType: "Tournament", medicalClearance: true, weighInStatus: "Overweight", registrationStatus: "Active" },
  { id: "13", licenseNumber: "IKF-26-0013", fullName: "Nadia Ali", dob: "1994-01-28", gender: "Female", country: "Tunisia 🇹🇳", nationalId: "TN753159", club: "Tunis Fight Club", weightCategory: "+65kg", ageGroup: "Senior A", licenseType: "Annual", medicalClearance: true, weighInStatus: "Confirmed", registrationStatus: "Active" },
  { id: "14", licenseNumber: "IKF-26-0014", fullName: "Omar Diallo", dob: "2000-08-08", gender: "Male", country: "Senegal 🇸🇳", nationalId: "SN159487", club: "Dakar Strikers", weightCategory: "-75kg", ageGroup: "Senior A", licenseType: "Tournament", medicalClearance: true, weighInStatus: "Pending", registrationStatus: "Active" },
  { id: "15", licenseNumber: "IKF-26-0015", fullName: "Elena Rossi", dob: "1996-05-04", gender: "Female", country: "Italy 🇮🇹", nationalId: "IT456789", club: "Rome Kenshido", weightCategory: "-55kg", ageGroup: "Senior A", licenseType: "Annual", medicalClearance: true, weighInStatus: "Confirmed", registrationStatus: "Active" },
];

type SetState = (partial: Partial<AthleteState> | ((state: AthleteState) => Partial<AthleteState>)) => void;

export const useAthleteStore = create<AthleteState>((set: SetState) => ({
  athletes: MOCK_ATHLETES,
  addAthlete: (athlete) => set((state) => ({ athletes: [athlete, ...state.athletes] })),
  updateAthlete: (id, data) => set((state) => ({
    athletes: state.athletes.map(a => a.id === id ? { ...a, ...data } : a)
  })),
}));
