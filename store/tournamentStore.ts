import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import type {
  Athlete, Club, WeighinRecord, Match, Bracket, Referee,
  RoundEvent, JudgeScore, TournamentReport, MatchResult,
  TournamentSettings, AgeGroup, TimerMode, WeighinStatus, AppNotification,
  BracketOptions, Pool, TeamMatchup, Standing, BracketFormat,
} from '@/types/tournament';
import { getSocket } from "@/lib/socketClient";
import {
  buildSingleElimination, buildDoubleElimination, buildRoundRobin,
  computeStandings, splitIntoPools, shuffle,
} from "@/lib/bracketGenerators";
import { v4 as uuid } from "uuid";

// ─── Seed Mock Data ──────────────────────────────────────────────────────────

const MOCK_CLUBS: Club[] = [
  { id: 'c1', name: 'Tunis Fight Club', country: 'Tunisia 🇹🇳', presidentName: 'Ahmed Trabelsi', email: 'contact@tunisfightclub.tn', phone: '+216 20 123 456', affiliationNumber: 'IKF-TN-001', expectedAthletes: 15, status: 'Active' },
  { id: 'c2', name: 'Algiers Strikers', country: 'Algeria 🇩🇿', presidentName: 'Karim Bouazizi', email: 'info@algiers-strikers.dz', phone: '+213 55 987 654', affiliationNumber: 'IKF-DZ-042', expectedAthletes: 10, status: 'Active' },
  { id: 'c3', name: 'Paris Kenshido', country: 'France 🇫🇷', presidentName: 'Marc Laurent', email: 'bureau@pariskenshido.fr', phone: '+33 6 12 34 56 78', affiliationNumber: 'IKF-FR-105', expectedAthletes: 8, status: 'Active' },
  { id: 'c4', name: 'Rabat Warriors', country: 'Morocco 🇲🇦', presidentName: 'Yassine Bounou', email: 'admin@rabatwarriors.ma', phone: '+212 6 00 11 22 33', affiliationNumber: 'IKF-MA-019', expectedAthletes: 20, status: 'Incomplete' },
  { id: 'c5', name: 'Cairo Martial Arts', country: 'Egypt 🇪🇬', presidentName: 'Mahmoud Hassan', email: 'info@cairomartialarts.eg', phone: '+20 10 1234 5678', affiliationNumber: 'IKF-EG-088', expectedAthletes: 12, status: 'Active' },
  { id: 'c6', name: 'Rio Kenshido', country: 'Brazil 🇧🇷', presidentName: 'Carlos Silva', email: 'contato@riokenshido.br', phone: '+55 21 98765-4321', affiliationNumber: 'IKF-BR-204', expectedAthletes: 5, status: 'Active' },
  { id: 'c7', name: 'Dakar Strikers', country: 'Senegal 🇸🇳', presidentName: 'Mamadou Ndiaye', email: 'hello@dakarstrikers.sn', phone: '+221 77 123 45 67', affiliationNumber: 'IKF-SN-033', expectedAthletes: 6, status: 'Suspended' },
  { id: 'c8', name: 'NY Martial Arts', country: 'USA 🇺🇸', presidentName: 'David Johnson', email: 'info@nymartialarts.com', phone: '+1 212-555-0198', affiliationNumber: 'IKF-US-551', expectedAthletes: 10, status: 'Active' },
];

const MOCK_ATHLETES: Athlete[] = [
  { id: 'a1', licenseNumber: 'IKF-26-0001', fullName: 'Youssef Ben Ali', dob: '1998-05-12', gender: 'Male', country: 'Tunisia 🇹🇳', nationalId: 'TN123456', clubId: 'c1', clubName: 'Tunis Fight Club', weightCategory: '-70kg', ageGroup: 'Senior A', licenseType: 'Annual', medicalClearance: true, weighInStatus: 'Confirmed', registrationStatus: 'Active' },
  { id: 'a2', licenseNumber: 'IKF-26-0002', fullName: 'Amira Kaddour', dob: '2001-08-22', gender: 'Female', country: 'Algeria 🇩🇿', nationalId: 'DZ987654', clubId: 'c2', clubName: 'Algiers Strikers', weightCategory: '-60kg', ageGroup: 'Senior B', licenseType: 'Annual', medicalClearance: true, weighInStatus: 'Pending', registrationStatus: 'Active' },
  { id: 'a3', licenseNumber: 'IKF-26-0003', fullName: 'Jean Dupont', dob: '1995-11-03', gender: 'Male', country: 'France 🇫🇷', nationalId: 'FR456123', clubId: 'c3', clubName: 'Paris Kenshido', weightCategory: '-80kg', ageGroup: 'Senior A', licenseType: 'Tournament', medicalClearance: true, weighInStatus: 'Confirmed', registrationStatus: 'Active' },
  { id: 'a4', licenseNumber: 'IKF-26-0004', fullName: 'Karim Ziyech', dob: '2000-01-15', gender: 'Male', country: 'Morocco 🇲🇦', nationalId: 'MA789456', clubId: 'c4', clubName: 'Rabat Warriors', weightCategory: '-65kg', ageGroup: 'Senior A', licenseType: 'Annual', medicalClearance: true, weighInStatus: 'Overweight', registrationStatus: 'Suspended' },
  { id: 'a5', licenseNumber: 'IKF-26-0005', fullName: 'Ahmed Hassan', dob: '2005-04-09', gender: 'Male', country: 'Egypt 🇪🇬', nationalId: 'EG321654', clubId: 'c5', clubName: 'Cairo Martial Arts', weightCategory: '-75kg', ageGroup: 'Senior C', licenseType: 'Tournament', medicalClearance: true, weighInStatus: 'Pending', registrationStatus: 'Active' },
  { id: 'a6', licenseNumber: 'IKF-26-0006', fullName: 'Sophie Martin', dob: '2008-09-30', gender: 'Female', country: 'France 🇫🇷', nationalId: 'FR159357', clubId: 'c3', clubName: 'Paris Kenshido', weightCategory: '-55kg', ageGroup: 'U18', licenseType: 'Annual', medicalClearance: true, weighInStatus: 'Confirmed', registrationStatus: 'Active' },
  { id: 'a7', licenseNumber: 'IKF-26-0007', fullName: 'Mehdi Taremi', dob: '1999-07-18', gender: 'Male', country: 'Tunisia 🇹🇳', nationalId: 'TN852963', clubId: 'c1', clubName: 'Tunis Fight Club', weightCategory: '-85kg', ageGroup: 'Senior B', licenseType: 'Annual', medicalClearance: true, weighInStatus: 'Confirmed', registrationStatus: 'Active' },
  { id: 'a8', licenseNumber: 'IKF-26-0008', fullName: 'Fatima Zahra', dob: '2003-12-05', gender: 'Female', country: 'Morocco 🇲🇦', nationalId: 'MA741852', clubId: 'c4', clubName: 'Rabat Warriors', weightCategory: '-50kg', ageGroup: 'Senior A', licenseType: 'Tournament', medicalClearance: true, weighInStatus: 'Pending', registrationStatus: 'Withdrawn' },
  { id: 'a9', licenseNumber: 'IKF-26-0009', fullName: 'Tariq Aziz', dob: '2010-02-14', gender: 'Male', country: 'Algeria 🇩🇿', nationalId: 'DZ369258', clubId: 'c2', clubName: 'Algiers Strikers', weightCategory: '-45kg', ageGroup: 'U16', licenseType: 'Annual', medicalClearance: true, weighInStatus: 'Confirmed', registrationStatus: 'Active' },
  { id: 'a10', licenseNumber: 'IKF-26-0010', fullName: 'Lucas Silva', dob: '1997-06-25', gender: 'Male', country: 'Brazil 🇧🇷', nationalId: 'BR147258', clubId: 'c6', clubName: 'Rio Kenshido', weightCategory: '-90kg', ageGroup: 'Senior A', licenseType: 'Annual', medicalClearance: true, weighInStatus: 'Confirmed', registrationStatus: 'Active' },
  { id: 'a11', licenseNumber: 'IKF-26-0011', fullName: 'Aya Mahmoud', dob: '2006-03-10', gender: 'Female', country: 'Egypt 🇪🇬', nationalId: 'EG258369', clubId: 'c5', clubName: 'Cairo Martial Arts', weightCategory: '-65kg', ageGroup: 'U18', licenseType: 'Annual', medicalClearance: true, weighInStatus: 'Pending', registrationStatus: 'Active' },
  { id: 'a12', licenseNumber: 'IKF-26-0012', fullName: 'David Kim', dob: '2002-10-19', gender: 'Male', country: 'USA 🇺🇸', nationalId: 'US963852', clubId: 'c8', clubName: 'NY Martial Arts', weightCategory: '-70kg', ageGroup: 'Senior B', licenseType: 'Tournament', medicalClearance: true, weighInStatus: 'Overweight', registrationStatus: 'Active' },
  { id: 'a13', licenseNumber: 'IKF-26-0013', fullName: 'Nadia Ali', dob: '1994-01-28', gender: 'Female', country: 'Tunisia 🇹🇳', nationalId: 'TN753159', clubId: 'c1', clubName: 'Tunis Fight Club', weightCategory: '+65kg', ageGroup: 'Senior A', licenseType: 'Annual', medicalClearance: true, weighInStatus: 'Confirmed', registrationStatus: 'Active' },
  { id: 'a14', licenseNumber: 'IKF-26-0014', fullName: 'Omar Diallo', dob: '2000-08-08', gender: 'Male', country: 'Senegal 🇸🇳', nationalId: 'SN159487', clubId: 'c7', clubName: 'Dakar Strikers', weightCategory: '-75kg', ageGroup: 'Senior A', licenseType: 'Tournament', medicalClearance: true, weighInStatus: 'Pending', registrationStatus: 'Active' },
  { id: 'a15', licenseNumber: 'IKF-26-0015', fullName: 'Elena Rossi', dob: '1996-05-04', gender: 'Female', country: 'Italy 🇮🇹', nationalId: 'IT456789', clubId: 'c8', clubName: 'NY Martial Arts', weightCategory: '-55kg', ageGroup: 'Senior A', licenseType: 'Annual', medicalClearance: true, weighInStatus: 'Confirmed', registrationStatus: 'Active' },
];

const MOCK_REFEREES: Referee[] = [
  { id: 'ref-1', name: 'Yoshiro Nakamura', role: 'Chief Referee', country: 'Japan 🇯🇵', grade: 'IKF Grade S', status: 'Available' },
  { id: 'ref-2', name: 'Sarah Collins', role: 'Central Referee', country: 'USA 🇺🇸', grade: 'IKF Grade A', status: 'In Match', currentMatchId: 'm1', currentAssignment: 'Mat 01 — Match #1' },
  { id: 'ref-3', name: 'Ahmed Mansour', role: 'Central Referee', country: 'Egypt 🇪🇬', grade: 'IKF Grade A', status: 'Available' },
  { id: 'ref-4', name: 'Elena Volkov', role: 'Central Referee', country: 'Russia 🇷🇺', grade: 'IKF Grade B', status: 'On Break' },
  { id: 'ref-5', name: 'Carlos Mendez', role: 'Corner Judge', country: 'Spain 🇪🇸', grade: 'IKF Grade B', status: 'In Match', currentMatchId: 'm1', currentAssignment: 'Mat 01 — Match #1' },
  { id: 'ref-6', name: 'Lucas Costa', role: 'Corner Judge', country: 'Brazil 🇧🇷', grade: 'IKF Grade B', status: 'Available' },
  { id: 'ref-7', name: 'Amina Diallo', role: 'Corner Judge', country: 'Senegal 🇸🇳', grade: 'IKF Grade C', status: 'Available' },
  { id: 'ref-8', name: 'Chen Wei', role: 'Corner Judge', country: 'China 🇨🇳', grade: 'IKF Grade A', status: 'In Match', currentMatchId: 'm1', currentAssignment: 'Mat 01 — Match #1' },
  { id: 'ref-9', name: 'David Smith', role: 'Corner Judge', country: 'UK 🇬🇧', grade: 'IKF Grade C', status: 'On Break' },
  { id: 'ref-10', name: 'Maria Garcia', role: 'Corner Judge', country: 'Mexico 🇲🇽', grade: 'IKF Grade B', status: 'Available' },
];

const MOCK_WEIGHIN_RECORDS: WeighinRecord[] = [
  { id: 'w1', athleteId: 'a3', athleteName: 'Jean Dupont', recordedWeight: 78.5, registeredCategory: '-80kg', assignedCategory: '-80kg', status: 'Confirmed', timestamp: '2026-06-10T08:15:22Z' },
  { id: 'w2', athleteId: 'a12', athleteName: 'David Kim', recordedWeight: 71.2, registeredCategory: '-70kg', assignedCategory: '-75kg', status: 'Overweight', timestamp: '2026-06-10T08:22:10Z' },
  { id: 'w3', athleteId: 'a15', athleteName: 'Elena Rossi', recordedWeight: 54.8, registeredCategory: '-55kg', assignedCategory: '-55kg', status: 'Confirmed', timestamp: '2026-06-10T08:35:05Z' },
  { id: 'w4', athleteId: 'a9', athleteName: 'Tariq Aziz', recordedWeight: 44.9, registeredCategory: '-45kg', assignedCategory: '-45kg', status: 'Confirmed', timestamp: '2026-06-10T08:42:50Z' },
];

// Seed 2 completed matches and a scheduled one for demo
const SEED_MATCHES: Match[] = [
  {
    id: 'm1', matchNumber: 1, bracketId: 'br1', category: '-70kg Senior A', ageGroup: 'Senior A', weightCategory: '-70kg', round: 'Semifinal',
    redCornerId: 'a1', blueCornerId: 'a12', redCornerName: 'Youssef Ben Ali', blueCornerName: 'David Kim',
    matNumber: 1, scheduledTime: '2026-06-10T14:30:00Z', status: 'completed', roundDurationSeconds: 180, totalRounds: 3,
    assignedRefereeId: 'ref-2', assignedJudgeIds: ['ref-5', 'ref-7', 'ref-8'],
    result: {
      winnerId: 'a1', winnerName: 'Youssef Ben Ali', winnerCorner: 'RED',
      method: 'majority-decision', redTotalScore: 87, blueTotalScore: 84,
      validatedAt: '2026-06-10T14:47:00Z',
      roundScores: [
        { round: 1, judgeId: 'ref-5', redScore: 10, blueScore: 9, submitted: true },
        { round: 1, judgeId: 'ref-7', redScore: 10, blueScore: 9, submitted: true },
        { round: 1, judgeId: 'ref-8', redScore: 9, blueScore: 10, submitted: true },
        { round: 2, judgeId: 'ref-5', redScore: 9, blueScore: 10, submitted: true },
        { round: 2, judgeId: 'ref-7', redScore: 10, blueScore: 9, submitted: true },
        { round: 2, judgeId: 'ref-8', redScore: 10, blueScore: 9, submitted: true },
        { round: 3, judgeId: 'ref-5', redScore: 10, blueScore: 9, submitted: true },
        { round: 3, judgeId: 'ref-7', redScore: 9, blueScore: 10, submitted: true },
        { round: 3, judgeId: 'ref-8', redScore: 10, blueScore: 9, submitted: true },
      ]
    }
  },
  {
    id: 'm2', matchNumber: 2, bracketId: 'br1', category: '-70kg Senior A', ageGroup: 'Senior A', weightCategory: '-70kg', round: 'Semifinal',
    redCornerId: 'a7', blueCornerId: 'a10', redCornerName: 'Mehdi Taremi', blueCornerName: 'Lucas Silva',
    matNumber: 2, scheduledTime: '2026-06-10T15:00:00Z', status: 'scheduled', roundDurationSeconds: 180, totalRounds: 3,
  },
  {
    id: 'm3', matchNumber: 3, bracketId: 'br1', category: '-70kg Senior A', ageGroup: 'Senior A', weightCategory: '-70kg', round: 'Final',
    redCornerId: 'a1', blueCornerId: '', redCornerName: 'Youssef Ben Ali', blueCornerName: 'TBD',
    matNumber: 1, scheduledTime: '2026-06-10T17:00:00Z', status: 'scheduled', roundDurationSeconds: 180, totalRounds: 3,
  },
];

const MOCK_BRACKETS: Bracket[] = [
  { id: 'br1', categoryId: '-70kg Senior A', format: 'Single Elimination', matchIds: ['m1', 'm2', 'm3'] },
];

// Seed judge scores for completed match
const SEED_JUDGE_SCORES: JudgeScore[] = SEED_MATCHES[0].result?.roundScores.map(rs => ({
  judgeId: rs.judgeId,
  judgeName: MOCK_REFEREES.find(r => r.id === rs.judgeId)?.name ?? rs.judgeId,
  matchId: 'm1',
  round: rs.round,
  redScore: rs.redScore,
  blueScore: rs.blueScore,
  submitted: true,
})) ?? [];

// Seed round events for completed match
const SEED_EVENTS: RoundEvent[] = [
  { id: 'e1', timestamp: '2026-06-10T14:30:00Z', type: 'match-start', details: 'Match #1 started' },
  { id: 'e2', timestamp: '2026-06-10T14:30:05Z', type: 'round-start', details: 'Round 1 started' },
  { id: 'e3', timestamp: '2026-06-10T14:32:41Z', type: 'yellow-card', corner: 'RED', details: 'Yellow card — passivity' },
  { id: 'e4', timestamp: '2026-06-10T14:33:00Z', type: 'round-end', details: 'Round 1 ended' },
  { id: 'e5', timestamp: '2026-06-10T14:34:00Z', type: 'round-start', details: 'Round 2 started' },
  { id: 'e6', timestamp: '2026-06-10T14:36:22Z', type: 'doctor', corner: 'BLUE', details: 'Doctor timeout — cleared' },
  { id: 'e7', timestamp: '2026-06-10T14:37:00Z', type: 'round-end', details: 'Round 2 ended' },
  { id: 'e8', timestamp: '2026-06-10T14:38:00Z', type: 'round-start', details: 'Round 3 started' },
  { id: 'e9', timestamp: '2026-06-10T14:40:05Z', type: 'round-end', details: 'Round 3 ended' },
  { id: 'e10', timestamp: '2026-06-10T14:40:10Z', type: 'match-end', details: 'Majority Decision — Red Corner WINS' },
];

const SEED_REPORTS: TournamentReport[] = [
  {
    id: 'rep1', matchId: 'm1', type: 'Match Report',
    title: 'Match #1 — Youssef Ben Ali vs David Kim — -70kg Senior A',
    generatedAt: '2026-06-10T14:47:00Z', status: 'Official',
    matchData: SEED_MATCHES[0],
    judgeScores: SEED_JUDGE_SCORES,
    events: SEED_EVENTS,
  }
];

const DEFAULT_SETTINGS: TournamentSettings = {
  tournamentName: 'IKF World Championship 2026',
  venue: 'Tunis Arena, Tunisia',
  startDate: '2026-06-10',
  defaultJudgesCount: 3,
  roundDurations: {
    'Mini': 60, 'Cadet': 90, 'Junior': 120, 'Senior': 180,
    'U8': 60, 'U10': 60, 'U12': 90, 'U14': 90,
    'U16': 120, 'U18': 120,
    'Senior A': 180, 'Senior B': 180, 'Senior C': 180,
  },
  language: 'en',
};

// ─── Store Interface ─────────────────────────────────────────────────────────

interface TournamentStore {
  // Settings
  settings: TournamentSettings;
  updateSettings: (data: Partial<TournamentSettings>) => void;

  // Athletes
  athletes: Athlete[];
  addAthlete: (a: Athlete) => void;
  updateAthlete: (id: string, data: Partial<Athlete>) => void;
  deleteAthlete: (id: string) => void;

  // Clubs
  clubs: Club[];
  addClub: (c: Club) => void;
  updateClub: (id: string, data: Partial<Club>) => void;
  deleteClub: (id: string) => void;

  // Weigh-in
  weighinRecords: WeighinRecord[];
  addWeighinRecord: (r: WeighinRecord) => void;
  updateAthleteWeighinStatus: (athleteId: string, status: WeighinStatus, newCategory?: string) => void;

  // Matches & Brackets
  matches: Match[];
  brackets: Bracket[];
  addMatch: (m: Match) => void;
  updateMatch: (id: string, data: Partial<Match>) => void;
  generateBracket: (categoryId: string, format: string, athletes: Athlete[], options?: BracketOptions) => void;
  deleteBracket: (bracketId: string) => void;
  updateMatchResult: (matchId: string, result: MatchResult) => void;
  advanceWinner: (matchId: string, winnerId: string, winnerName: string) => void;
  updateRoundRobinStandings: (bracketId: string) => void;
  advancePoolWinners: (bracketId: string) => void;
  updateTeamScore: (teamMatchupId: string) => void;

  // Referees
  referees: Referee[];
  addReferee: (r: Referee) => void;
  updateReferee: (id: string, data: Partial<Referee>) => void;
  assignRefereeToMatch: (matchId: string, refereeId: string, judgeIds: string[]) => void;

  // Active Match & Round State
  activeMatch: Match | null;
  setActiveMatch: (m: Match | null) => void;
  currentRound: number;
  setCurrentRound: (r: number) => void;
  roundTimer: number;
  setRoundTimer: (t: number) => void;
  timerMode: TimerMode;
  setTimerMode: (mode: TimerMode) => void;
  roundEvents: RoundEvent[];
  addRoundEvent: (e: Omit<RoundEvent, 'id' | 'timestamp'>) => void;
  clearRoundEvents: () => void;

  // Judging
  judgeScores: JudgeScore[];
  setJudgeScore: (score: JudgeScore) => void;
  submitJudgeScore: (judgeId: string, round: number, redScore: number, blueScore: number, matchId: string, judgeName: string) => void;
  currentResult: MatchResult | null;
  validateResult: (matchId: string, judgeIds: string[]) => void;
  overrideResult: (matchId: string, winnerId: string, winnerName: string, winnerCorner: 'RED' | 'BLUE', reason: string) => void;
  clearJudgeScores: (matchId: string) => void;

  // Reports
  reports: TournamentReport[];
  generateReport: (matchId: string) => void;
  updateReportStatus: (reportId: string, status: 'Draft' | 'Official' | 'Exported') => void;

  // Notifications
  notifications: AppNotification[];
  addNotification: (title: string, message: string) => void;
  markNotificationsRead: () => void;
}

// ─── Store Implementation ────────────────────────────────────────────────────

type SetState = (partial: Partial<TournamentStore> | ((state: TournamentStore) => Partial<TournamentStore>)) => void;
type GetState = () => TournamentStore;

export const useTournamentStore = create<TournamentStore>()(persist((set: SetState, get: GetState) => ({
  settings: DEFAULT_SETTINGS,
  updateSettings: (data) => set(s => ({ settings: { ...s.settings, ...data } })),
  notifications: [
    { id: '1', title: 'Tournament Initialized', message: 'IKF Kenshido platform is online.', time: new Date().toISOString(), read: false }
  ],
  addNotification: (title, message) => set(s => ({
    notifications: [{ id: uuidv4(), title, message, time: new Date().toISOString(), read: false }, ...s.notifications].slice(0, 50)
  })),
  markNotificationsRead: () => set(s => ({
    notifications: s.notifications.map(n => ({ ...n, read: true }))
  })),

  // ── Athletes ──
  athletes: MOCK_ATHLETES,
  addAthlete: (a) => {
    set(s => ({ athletes: [a, ...s.athletes] }));
    get().addNotification("New Athlete Registered", `${a.fullName} added to ${a.weightCategory}`);
    toast.success(`Athlete ${a.fullName} registered successfully`, { style: { background: '#27ae60', color: '#fff' } });
  },
  updateAthlete: (id, data) => set(s => ({
    athletes: s.athletes.map(a => a.id === id ? { ...a, ...data } : a)
  })),
  deleteAthlete: (id) => set(s => ({ athletes: s.athletes.filter(a => a.id !== id) })),

  // ── Clubs ──
  clubs: MOCK_CLUBS,
  addClub: (c) => {
    set(s => ({ clubs: [c, ...s.clubs] }));
    get().addNotification("New Club Registered", `${c.name} (${c.country}) joined the tournament.`);
    toast.success(`Club ${c.name} registered successfully`, { style: { background: '#27ae60', color: '#fff' } });
  },
  updateClub: (id, data) => set(s => ({
    clubs: s.clubs.map(c => c.id === id ? { ...c, ...data } : c)
  })),
  deleteClub: (id) => set(s => ({ clubs: s.clubs.filter(c => c.id !== id) })),

  // ── Weigh-in ──
  weighinRecords: MOCK_WEIGHIN_RECORDS,
  addWeighinRecord: (r) => set(s => ({ weighinRecords: [r, ...s.weighinRecords] })),
  updateAthleteWeighinStatus: (athleteId, status, newCategory) => set(s => ({
    athletes: s.athletes.map(a =>
      a.id === athleteId
        ? { ...a, weighInStatus: status, ...(newCategory ? { weightCategory: newCategory } : {}) }
        : a
    )
  })),

  // ── Matches & Brackets ──
  matches: SEED_MATCHES,
  brackets: MOCK_BRACKETS,
  addMatch: (m) => {
    set(s => ({ matches: [...s.matches, m] }));
    toast.success("Match saved successfully", { style: { background: '#27ae60', color: '#fff' } });
  },
  updateMatch: (id, data) => {
    set(s => ({
      matches: s.matches.map(m => m.id === id ? { ...m, ...data } : m)
    }));
    toast.success("Match updated successfully", { style: { background: '#27ae60', color: '#fff' } });
  },

  generateBracket: (categoryId, format, eligibleAthletes, options) => {
    const fmt = format as BracketFormat;
    if (eligibleAthletes.length < 2) {
      toast.error('Not enough athletes — need at least 2 confirmed athletes to generate a bracket');
      return;
    }

    const settings = get().settings;
    const ageGroup = (eligibleAthletes[0]?.ageGroup ?? 'Senior') as AgeGroup;
    const roundDuration = settings.roundDurations[ageGroup] ?? 180;
    const weightCategory = categoryId.split(' ')[0];
    const bracketId = uuid();
    const startMatchNumber = get().matches.length + 1;
    const base = {
      category: categoryId, ageGroup, weightCategory,
      roundDuration, startMatchNumber, startTime: Date.now(), bracketId,
    };

    const seeded = options?.seeding ? [...eligibleAthletes] : shuffle(eligibleAthletes);
    let newMatches: Match[] = [];
    let bracket: Bracket;

    if (fmt === 'single-elimination') {
      const res = buildSingleElimination(seeded, base);
      newMatches = res.matches;
      bracket = {
        id: bracketId, categoryId, category: categoryId, ageGroup, weightCategory,
        format: fmt, status: 'in-progress',
        matchIds: newMatches.map(m => m.id), matches: newMatches.map(m => m.id),
      };
      if (res.byes > 0) toast(`${seeded.length} athletes — ${res.byes} BYEs assigned automatically`, { icon: 'ℹ️' });
    } else if (fmt === 'double-elimination') {
      const res = buildDoubleElimination(seeded, base);
      newMatches = res.matches;
      bracket = {
        id: bracketId, categoryId, category: categoryId, ageGroup, weightCategory,
        format: fmt, status: 'in-progress',
        matchIds: newMatches.map(m => m.id), matches: newMatches.map(m => m.id),
        winnersBracketMatches: res.winnersIds, losersBracketMatches: res.losersIds,
        grandFinalMatchId: res.grandFinalId,
      };
      if (res.byes > 0) toast(`${seeded.length} athletes — ${res.byes} BYEs assigned automatically`, { icon: 'ℹ️' });
    } else if (fmt === 'round-robin') {
      const pointsForWin = options?.pointsForWin ?? 3;
      const pointsForDraw = options?.pointsForDraw ?? 1;
      newMatches = buildRoundRobin(seeded, base);
      bracket = {
        id: bracketId, categoryId, category: categoryId, ageGroup, weightCategory,
        format: fmt, status: 'in-progress',
        matchIds: newMatches.map(m => m.id), matches: newMatches.map(m => m.id),
        pointsForWin, pointsForDraw,
        standings: computeStandings(seeded, newMatches, pointsForWin, pointsForDraw),
      };
    } else if (fmt === 'pool-elimination') {
      const perPool = options?.athletesPerPool ?? 4;
      const grouped = splitIntoPools(seeded, perPool);
      const pools: Pool[] = [];
      grouped.forEach((poolAthletes, idx) => {
        const poolId = uuid();
        const poolMatches = buildRoundRobin(poolAthletes, { ...base, startMatchNumber: startMatchNumber + newMatches.length }, poolId);
        newMatches.push(...poolMatches);
        pools.push({
          id: poolId, name: `POOL ${String.fromCharCode(65 + idx)}`,
          athleteIds: poolAthletes.map(a => a.id), matchIds: poolMatches.map(m => m.id),
          standings: computeStandings(poolAthletes, poolMatches, 3, 1), complete: false,
        });
      });
      bracket = {
        id: bracketId, categoryId, category: categoryId, ageGroup, weightCategory,
        format: fmt, status: 'in-progress',
        matchIds: newMatches.map(m => m.id), matches: newMatches.map(m => m.id),
        pools, eliminationMatches: [], eliminationUnlocked: false,
      };
      if (seeded.length < 8) toast('Minimum 8 athletes recommended for Pool + Elimination format.', { icon: 'ℹ️' });
    } else if (fmt === 'team') {
      // Group athletes by club.
      const clubsMap = new Map<string, Athlete[]>();
      seeded.forEach(a => {
        const list = clubsMap.get(a.clubId) ?? [];
        list.push(a); clubsMap.set(a.clubId, list);
      });
      const teams = shuffle(Array.from(clubsMap.entries()).map(([clubId, members]) => ({
        clubId, clubName: members[0]?.clubName ?? clubId, members,
      })));
      if (teams.length < 2) {
        toast.error('Need at least 2 clubs represented to generate a team tournament');
        return;
      }
      const teamMatchups: TeamMatchup[] = [];
      const matchByWeight = options?.matchByWeight ?? true;
      // Single-elimination at team level: pair sequentially for round 1.
      for (let i = 0; i + 1 < teams.length; i += 2) {
        const red = teams[i];
        const blue = teams[i + 1];
        const matchupId = uuid();
        const individualMatchIds: string[] = [];
        const redCats = new Set(red.members.map(m => m.weightCategory));
        const blueByCat = new Map(blue.members.map(m => [m.weightCategory, m]));
        const sharedCats = matchByWeight
          ? Array.from(redCats).filter(c => blueByCat.has(c))
          : Array.from(redCats);
        sharedCats.forEach((cat, idx) => {
          const redFighter = red.members.find(m => m.weightCategory === cat)!;
          const blueFighter = matchByWeight ? blueByCat.get(cat)! : blue.members[idx];
          if (!blueFighter) { toast(`${red.clubName} has no opponent for ${cat} — skipped`, { icon: '⚠️' }); return; }
          const mId = uuid();
          individualMatchIds.push(mId);
          newMatches.push({
            id: mId, matchNumber: startMatchNumber + newMatches.length, bracketId,
            category: `${cat} — ${red.clubName} vs ${blue.clubName}`, ageGroup, weightCategory: cat,
            round: 'Team Fight',
            redCornerId: redFighter.id, blueCornerId: blueFighter.id,
            redCornerName: redFighter.fullName, blueCornerName: blueFighter.fullName,
            matNumber: (newMatches.length % 3) + 1,
            scheduledTime: new Date(base.startTime + newMatches.length * 15 * 60000).toISOString(),
            status: 'scheduled', roundDurationSeconds: roundDuration, totalRounds: ageGroup.startsWith('U') ? 2 : 3,
            teamMatchupId: matchupId,
          });
        });
        teamMatchups.push({
          id: matchupId, redClubId: red.clubId, blueClubId: blue.clubId,
          redClubName: red.clubName, blueClubName: blue.clubName,
          individualMatchIds, redWins: 0, blueWins: 0, status: 'scheduled',
        });
      }
      bracket = {
        id: bracketId, categoryId, category: categoryId, ageGroup, weightCategory,
        format: fmt, status: 'in-progress',
        matchIds: newMatches.map(m => m.id), matches: newMatches.map(m => m.id),
        teamMatchups,
      };
    } else {
      toast.error(`Unknown bracket format: ${format}`);
      return;
    }

    set(s => ({ matches: [...s.matches, ...newMatches], brackets: [...s.brackets, bracket] }));
    toast.success(`Bracket generated for ${categoryId} — ${eligibleAthletes.length} athletes, ${newMatches.length} matches`);
  },

  deleteBracket: (bracketId) => set(s => {
    const bracket = s.brackets.find(b => b.id === bracketId);
    const matchIds = new Set(bracket?.matchIds ?? []);
    return {
      brackets: s.brackets.filter(b => b.id !== bracketId),
      matches: s.matches.filter(m => !matchIds.has(m.id)),
      judgeScores: s.judgeScores.filter(j => !matchIds.has(j.matchId)),
    };
  }),

  updateMatchResult: (matchId, result) => set(s => ({
    matches: s.matches.map(m =>
      m.id === matchId ? { ...m, status: 'completed', result } : m
    )
  })),

  advanceWinner: (matchId, winnerId, winnerName) => {
    const state = get();
    const currentMatch = state.matches.find(m => m.id === matchId);
    if (!currentMatch) return;
    const bracket = state.brackets.find(b => b.matchIds.includes(matchId));

    // Determine the loser (for double elimination drop-down).
    const loserId = currentMatch.redCornerId === winnerId ? currentMatch.blueCornerId : currentMatch.redCornerId;
    const loserName = currentMatch.redCornerId === winnerId ? currentMatch.blueCornerName : currentMatch.redCornerName;

    if (currentMatch.nextMatchId || currentMatch.loserNextMatchId) {
      // Explicit wiring (new multi-format brackets).
      set(s => ({
        matches: s.matches.map(m => {
          if (m.id === currentMatch.nextMatchId) {
            return currentMatch.nextMatchSlot === 'RED'
              ? { ...m, redCornerId: winnerId, redCornerName: winnerName }
              : { ...m, blueCornerId: winnerId, blueCornerName: winnerName };
          }
          if (m.id === currentMatch.loserNextMatchId && loserId) {
            return currentMatch.loserNextMatchSlot === 'RED'
              ? { ...m, redCornerId: loserId, redCornerName: loserName }
              : { ...m, blueCornerId: loserId, blueCornerName: loserName };
          }
          return m;
        }),
      }));
    } else if (bracket) {
      // Legacy positional advancement (seed data / older brackets).
      const currentIndex = bracket.matchIds.indexOf(matchId);
      const nextMatchIndex = Math.floor(currentIndex / 2) + Math.floor(bracket.matchIds.length / 2);
      const nextMatchId = bracket.matchIds[nextMatchIndex];
      if (nextMatchId && nextMatchId !== matchId) {
        const isEvenSlot = currentIndex % 2 === 0;
        set(s => ({
          matches: s.matches.map(m => m.id === nextMatchId
            ? { ...m, ...(isEvenSlot ? { redCornerId: winnerId, redCornerName: winnerName } : { blueCornerId: winnerId, blueCornerName: winnerName }) }
            : m),
        }));
      }
    }

    // Format-specific follow-ups.
    if (bracket) {
      if (bracket.format === 'round-robin') get().updateRoundRobinStandings(bracket.id);
      if (bracket.format === 'pool-elimination') get().advancePoolWinners(bracket.id);
      if (bracket.format === 'team' && currentMatch.teamMatchupId) get().updateTeamScore(currentMatch.teamMatchupId);
    }
  },

  updateRoundRobinStandings: (bracketId) => {
    const state = get();
    const bracket = state.brackets.find(b => b.id === bracketId);
    if (!bracket) return;
    const bracketMatches = state.matches.filter(m => bracket.matchIds.includes(m.id));
    const athleteIds = new Set<string>();
    bracketMatches.forEach(m => { athleteIds.add(m.redCornerId); athleteIds.add(m.blueCornerId); });
    const athletes = state.athletes.filter(a => athleteIds.has(a.id));
    const standings = computeStandings(athletes, bracketMatches, bracket.pointsForWin ?? 3, bracket.pointsForDraw ?? 1);
    const complete = bracketMatches.every(m => m.status === 'completed');
    set(s => ({
      brackets: s.brackets.map(b => b.id === bracketId
        ? { ...b, standings, status: complete ? 'complete' : 'in-progress' }
        : b),
    }));
  },

  advancePoolWinners: (bracketId) => {
    const state = get();
    const bracket = state.brackets.find(b => b.id === bracketId);
    if (!bracket || !bracket.pools) return;

    // Recompute each pool's standings + completion.
    const updatedPools: Pool[] = bracket.pools.map(pool => {
      const poolMatches = state.matches.filter(m => pool.matchIds.includes(m.id));
      const poolAthletes = state.athletes.filter(a => pool.athleteIds.includes(a.id));
      const standings = computeStandings(poolAthletes, poolMatches, 3, 1);
      const complete = poolMatches.length > 0 && poolMatches.every(m => m.status === 'completed');
      return { ...pool, standings, complete };
    });

    const allPoolsComplete = updatedPools.every(p => p.complete);
    let eliminationMatches = bracket.eliminationMatches ?? [];
    let newMatches: Match[] = [];
    let eliminationUnlocked = bracket.eliminationUnlocked ?? false;

    if (allPoolsComplete && !eliminationUnlocked) {
      // Top 2 from each pool advance.
      const qualifiers: Athlete[] = [];
      updatedPools.forEach(pool => {
        pool.standings.slice(0, 2).forEach(st => {
          const ath = state.athletes.find(a => a.id === st.athleteId);
          if (ath) qualifiers.push(ath);
        });
      });
      if (qualifiers.length >= 2) {
        const ageGroup = (qualifiers[0]?.ageGroup ?? 'Senior') as AgeGroup;
        const roundDuration = state.settings.roundDurations[ageGroup] ?? 180;
        const res = buildSingleElimination(qualifiers, {
          category: `${bracket.category} — Finals`, ageGroup,
          weightCategory: bracket.weightCategory ?? '', roundDuration,
          startMatchNumber: state.matches.length + 1, startTime: Date.now(), bracketId: bracket.id,
        });
        newMatches = res.matches;
        eliminationMatches = newMatches.map(m => m.id);
        eliminationUnlocked = true;
        toast.success('Pool stage complete — elimination bracket unlocked');
      }
    }

    set(s => ({
      matches: [...s.matches, ...newMatches],
      brackets: s.brackets.map(b => b.id === bracketId
        ? {
            ...b, pools: updatedPools, eliminationMatches, eliminationUnlocked,
            matchIds: [...b.matchIds, ...newMatches.map(m => m.id)],
            matches: [...(b.matches ?? b.matchIds), ...newMatches.map(m => m.id)],
          }
        : b),
    }));
  },

  updateTeamScore: (teamMatchupId) => {
    const state = get();
    const bracket = state.brackets.find(b => b.teamMatchups?.some(tm => tm.id === teamMatchupId));
    if (!bracket || !bracket.teamMatchups) return;
    const updated = bracket.teamMatchups.map(tm => {
      if (tm.id !== teamMatchupId) return tm;
      const fights = state.matches.filter(m => tm.individualMatchIds.includes(m.id));
      let redWins = 0, blueWins = 0;
      fights.forEach(f => {
        if (f.status === 'completed' && f.result) {
          if (f.result.winnerId === f.redCornerId) redWins++;
          else if (f.result.winnerId === f.blueCornerId) blueWins++;
        }
      });
      const allDone = fights.length > 0 && fights.every(f => f.status === 'completed');
      const winnerId = redWins > blueWins ? tm.redClubId : blueWins > redWins ? tm.blueClubId : undefined;
      return {
        ...tm, redWins, blueWins,
        status: allDone ? 'complete' as const : (redWins + blueWins > 0 ? 'in-progress' as const : 'scheduled' as const),
        winnerId: allDone ? winnerId : undefined,
      };
    });
    set(s => ({
      brackets: s.brackets.map(b => b.id === bracket.id ? { ...b, teamMatchups: updated } : b),
    }));
  },

  // ── Referees ──
  referees: MOCK_REFEREES,
  addReferee: (r) => set(s => ({ referees: [r, ...s.referees] })),
  updateReferee: (id, data) => set(s => ({
    referees: s.referees.map(r => r.id === id ? { ...r, ...data } : r)
  })),
  assignRefereeToMatch: (matchId, refereeId, judgeIds) => {
    const match = get().matches.find(m => m.id === matchId);
    if (!match) return;
    if (judgeIds.includes(refereeId)) {
      toast.error('Central referee cannot also be selected as a corner judge');
      return;
    }
    const unavailable = get().referees.filter(r => [refereeId, ...judgeIds].includes(r.id) && r.status !== 'Available' && r.currentMatchId !== matchId);
    if (unavailable.length > 0) {
      toast.error(`${unavailable[0].name} is not available for assignment`);
      return;
    }
    const ref = get().referees.find(r => r.id === refereeId);
    const assignment = `Mat ${match.matNumber} — Match #${match.matchNumber}`;

    set(s => ({
      matches: s.matches.map(m =>
        m.id === matchId ? { ...m, assignedRefereeId: refereeId, assignedJudgeIds: judgeIds } : m
      ),
      referees: s.referees.map(r => {
        if (r.id === refereeId) return { ...r, status: 'In Match', currentMatchId: matchId, currentAssignment: assignment };
        if (judgeIds.includes(r.id)) return { ...r, status: 'In Match', currentMatchId: matchId, currentAssignment: assignment };
        return r;
      }),
    }));

    toast.success(`${ref?.name ?? 'Referee'} assigned to ${assignment}`);
  },

  // ── Active Match & Round ──
  activeMatch: null,
  setActiveMatch: (m) => {
    const state = get();
    const duration = m ? (state.settings.roundDurations[m.ageGroup] ?? 180) : 0;
    set({
      activeMatch: m,
      currentRound: 1,
      roundTimer: duration,
      timerMode: 'idle',
      roundEvents: [],
      currentResult: null,
    });
    // Clear judge scores for new match
    if (m) get().clearJudgeScores(m.id);
  },
  currentRound: 1,
  setCurrentRound: (r) => set({ currentRound: r }),
  roundTimer: 180,
  setRoundTimer: (t) => {
    set({ roundTimer: t });
    getSocket()?.emit('send-event', { type: 'timer_update', data: { roundTimer: t } });
  },
  timerMode: 'idle',
  setTimerMode: (mode) => {
    set({ timerMode: mode });
    getSocket()?.emit('send-event', { type: 'timer_update', data: { timerMode: mode } });
  },
  roundEvents: [],
  addRoundEvent: (e) => {
    const newEvent = { ...e, id: uuidv4(), timestamp: new Date().toISOString() };
    set(s => ({
      roundEvents: [...s.roundEvents, newEvent]
    }));
    getSocket()?.emit('send-event', { type: 'round_event_added', data: { event: newEvent } });
  },
  clearRoundEvents: () => set({ roundEvents: [] }),

  // ── Judging ──
  judgeScores: SEED_JUDGE_SCORES,
  setJudgeScore: (score) => set(s => {
    const existing = s.judgeScores.findIndex(
      js => js.judgeId === score.judgeId && js.matchId === score.matchId && js.round === score.round
    );
    if (existing >= 0) {
      const updated = [...s.judgeScores];
      updated[existing] = score;
      return { judgeScores: updated };
    }
    return { judgeScores: [...s.judgeScores, score] };
  }),

  submitJudgeScore: (judgeId, round, redScore, blueScore, matchId, judgeName) => {
    const score: JudgeScore = { judgeId, judgeName, matchId, round, redScore, blueScore, submitted: true };
    get().setJudgeScore(score);
    getSocket()?.emit('send-event', { type: 'judge_score_submitted', data: { score } });
    toast.success(`${judgeName} — Round ${round} score submitted ✅`, { duration: 3000 });
  },

  currentResult: null,

  validateResult: (matchId, judgeIds) => {
    const state = get();
    const scores = state.judgeScores.filter(s => s.matchId === matchId && s.submitted);
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    // Aggregate per judge
    const judgeAgg = judgeIds.map(jid => {
      const js = scores.filter(s => s.judgeId === jid);
      const red = js.reduce((a, s) => a + s.redScore, 0);
      const blue = js.reduce((a, s) => a + s.blueScore, 0);
      return { judgeId: jid, redWins: red > blue, redTotal: red, blueTotal: blue };
    });

    const redWins = judgeAgg.filter(j => j.redWins).length;
    const blueWins = judgeAgg.filter(j => !j.redWins).length;
    const totalRed = judgeAgg.reduce((a, j) => a + j.redTotal, 0);
    const totalBlue = judgeAgg.reduce((a, j) => a + j.blueTotal, 0);

    const winnerCorner: 'RED' | 'BLUE' = redWins >= blueWins ? 'RED' : 'BLUE';
    const winnerId = winnerCorner === 'RED' ? match.redCornerId : match.blueCornerId;
    const winnerName = winnerCorner === 'RED' ? match.redCornerName : match.blueCornerName;
    const method = redWins === blueWins ? 'split-decision' :
      (redWins === judgeIds.length || blueWins === judgeIds.length) ? 'unanimous-decision' : 'majority-decision';

    const result: MatchResult = {
      winnerId, winnerName, winnerCorner, method,
      redTotalScore: totalRed, blueTotalScore: totalBlue,
      roundScores: scores,
      validatedAt: new Date().toISOString(),
    };

    set({ currentResult: result });
    get().updateMatchResult(matchId, result);
    get().advanceWinner(matchId, winnerId, winnerName);
    get().generateReport(matchId);
    get().addRoundEvent({ type: 'match-end', details: `${winnerName} wins by ${method}` });
    get().addNotification("Match Result Validated", `${winnerName} won by ${method}`);

    toast.success(`✅ Result VALIDATED — ${winnerName} (${winnerCorner}) wins by ${method}`, { 
      duration: 6000, 
      style: { background: 'var(--ikf-gold)', color: '#000', fontWeight: 'bold' } 
    });
    getSocket()?.emit('send-event', { type: 'result_validated', data: { result } });
  },

  overrideResult: (matchId, winnerId, winnerName, winnerCorner, reason) => {
    const match = get().matches.find(m => m.id === matchId);
    if (!match) return;

    const result: MatchResult = {
      winnerId, winnerName, winnerCorner, method: 'disqualification',
      redTotalScore: 0, blueTotalScore: 0, roundScores: [],
      validatedAt: new Date().toISOString(),
    };

    set({ currentResult: result });
    get().updateMatchResult(matchId, result);
    get().advanceWinner(matchId, winnerId, winnerName);
    get().generateReport(matchId);
    get().addRoundEvent({ type: 'match-end', corner: winnerCorner, details: `OVERRIDE — ${winnerName} wins. Reason: ${reason}` });

    toast(`⚖️ RESULT OVERRIDDEN — ${winnerName} declared winner`, { 
      duration: 6000, 
      icon: '⚖️',
      style: { background: 'var(--ikf-gold)', color: '#000', fontWeight: 'bold' } 
    });
    getSocket()?.emit('send-event', { type: 'result_overridden', data: { result } });
  },

  clearJudgeScores: (matchId) => set(s => ({
    judgeScores: s.judgeScores.filter(js => js.matchId !== matchId),
    currentResult: null,
  })),

  // ── Reports ──
  reports: SEED_REPORTS,
  generateReport: (matchId) => {
    const state = get();
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    const existingIndex = state.reports.findIndex(r => r.matchId === matchId);
    const report: TournamentReport = {
      id: existingIndex >= 0 ? state.reports[existingIndex].id : uuidv4(),
      matchId,
      type: 'Match Report',
      title: `Match #${match.matchNumber} — ${match.redCornerName} vs ${match.blueCornerName} — ${match.category}`,
      generatedAt: new Date().toISOString(),
      status: 'Draft',
      matchData: match,
      judgeScores: state.judgeScores.filter(js => js.matchId === matchId),
      events: [...state.roundEvents],
    };

    if (existingIndex >= 0) {
      set(s => ({
        reports: s.reports.map((r, i) => i === existingIndex ? report : r)
      }));
    } else {
      set(s => ({ reports: [report, ...s.reports] }));
    }
  },

  updateReportStatus: (reportId, status) => set(s => ({
    reports: s.reports.map(r => r.id === reportId ? { ...r, status } : r)
  })),
}), {
  name: 'ikf-tournament-store',
  storage: createJSONStorage(() => localStorage),
  // Only persist domain data; keep transient match/round/timer state in memory.
  partialize: (state) => ({
    settings: state.settings,
    athletes: state.athletes,
    clubs: state.clubs,
    weighinRecords: state.weighinRecords,
    matches: state.matches,
    brackets: state.brackets,
    referees: state.referees,
    judgeScores: state.judgeScores,
    reports: state.reports,
    notifications: state.notifications,
  }),
}));

// ─── Selector helpers ────────────────────────────────────────────────────────

export const useActiveMatchJudgeScores = () => {
  const { activeMatch, judgeScores } = useTournamentStore();
  if (!activeMatch) return [];
  return judgeScores.filter(js => js.matchId === activeMatch.id);
};

export const useLiveAggregateScore = () => {
  const scores = useActiveMatchJudgeScores();
  const red = scores.filter(s => s.submitted).reduce((a, s) => a + s.redScore, 0);
  const blue = scores.filter(s => s.submitted).reduce((a, s) => a + s.blueScore, 0);
  return { red, blue };
};
