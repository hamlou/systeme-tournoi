// ─── IKF Kenshido — Shared Types ─────────────────────────────────────────────

export type AgeGroup = 'Mini' | 'Cadet' | 'Junior' | 'Senior' | 'U8' | 'U10' | 'U12' | 'U14' | 'U16' | 'U18' | 'Senior A' | 'Senior B' | 'Senior C';
export type Gender = 'Male' | 'Female';
export type WeighinStatus = 'Pending' | 'Confirmed' | 'Overweight';
export type RegistrationStatus = 'Active' | 'Withdrawn' | 'Suspended';
export type MatchStatus = 'scheduled' | 'in-progress' | 'completed';
export type TimerMode = 'idle' | 'round' | 'rest' | 'passivity' | 'medical';
export type WinMethod = 'majority-decision' | 'unanimous-decision' | 'split-decision' | 'KO' | 'TKO' | 'ippon' | 'disqualification' | 'draw' | 'withdrawal';
export type RoundEventType = 'round-start' | 'round-end' | 'wosk-stop' | 'doctor' | 'yellow-card' | 'red-card' | 'deduction' | 'ippon' | 'waza-ari' | 'yuko' | 'match-end' | 'match-start';
export type ReportStatus = 'Draft' | 'Official' | 'Exported';
export type RefRole = 'Chief Referee' | 'Central Referee' | 'Corner Judge';
export type RefStatus = 'Available' | 'In Match' | 'On Break';

export interface Athlete {
  id: string;
  licenseNumber: string;
  fullName: string;
  dob: string;
  gender: Gender;
  country: string;
  nationalId: string;
  clubId: string;   // links to Club.id
  clubName: string; // denormalised for display
  weightCategory: string;
  ageGroup: AgeGroup;
  licenseType: 'Annual' | 'Tournament';
  medicalClearance: boolean;
  weighInStatus: WeighinStatus;
  registrationStatus: RegistrationStatus;
  photoUrl?: string;
}

export interface Club {
  id: string;
  name: string;
  country: string;
  presidentName: string;
  email: string;
  phone: string;
  affiliationNumber?: string;
  expectedAthletes: number;
  status: 'Active' | 'Incomplete' | 'Suspended';
  logoUrl?: string;
  notes?: string;
}

export interface WeighinRecord {
  id: string;
  athleteId: string;
  athleteName: string;
  recordedWeight: number;
  registeredCategory: string;
  assignedCategory: string;
  status: 'Confirmed' | 'Overweight' | 'Reassigned';
  timestamp: string;
}

export interface RoundScore {
  round: number;
  judgeId: string;
  redScore: number;
  blueScore: number;
  submitted: boolean;
}

export interface MatchResult {
  winnerId: string;
  winnerName: string;
  winnerCorner: 'RED' | 'BLUE';
  method: WinMethod;
  redTotalScore: number;
  blueTotalScore: number;
  roundScores: RoundScore[];
  validatedAt: string;
}

export interface Match {
  id: string;
  matchNumber: number;
  bracketId: string;
  category: string;
  ageGroup: AgeGroup;
  weightCategory: string;
  round: string;
  redCornerId: string;
  blueCornerId: string;
  redCornerName: string;
  blueCornerName: string;
  matNumber: number;
  scheduledTime: string | null;
  status: MatchStatus;
  result?: MatchResult;
  assignedRefereeId?: string;
  assignedJudgeIds?: string[];
  roundDurationSeconds: number;
  totalRounds: number;
  // Feed-forward wiring used by generated brackets.
  nextMatchId?: string;
  nextMatchSlot?: 'RED' | 'BLUE';
  loserNextMatchId?: string;
  loserNextMatchSlot?: 'RED' | 'BLUE';
  // Grouping for the various formats.
  bracketType?: 'winners' | 'losers' | 'grand-final';
  poolId?: string;
  teamMatchupId?: string;
  isBye?: boolean;
}

export type BracketFormat =
  | 'single-elimination'
  | 'double-elimination'
  | 'round-robin'
  | 'pool-elimination'
  | 'team';

export type BracketStatus = 'pending' | 'in-progress' | 'complete';

export interface Standing {
  athleteId: string;
  athleteName: string;
  clubName: string;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  matchesPlayed: number;
}

export interface Pool {
  id: string;
  name: string; // 'POOL A', 'POOL B', etc.
  athleteIds: string[];
  matchIds: string[];
  standings: Standing[];
  complete: boolean;
}

export interface TeamMatchup {
  id: string;
  redClubId: string;
  blueClubId: string;
  redClubName: string;
  blueClubName: string;
  individualMatchIds: string[];
  redWins: number;
  blueWins: number;
  status: 'scheduled' | 'in-progress' | 'complete';
  winnerId?: string;
}

export interface Bracket {
  id: string;
  // Legacy fields kept for backwards compatibility with existing data/logic.
  categoryId: string;
  matchIds: string[];
  // New, richer descriptors.
  category?: string;
  ageGroup?: string;
  weightCategory?: string;
  format: BracketFormat | string;
  status?: BracketStatus;
  matches?: string[]; // mirror of matchIds for the new API
  // Double elimination
  bracketType?: 'winners' | 'losers';
  winnersBracketMatches?: string[];
  losersBracketMatches?: string[];
  grandFinalMatchId?: string;
  grandFinalResetMatchId?: string;
  // Round robin
  standings?: Standing[];
  pointsForWin?: number;
  pointsForDraw?: number;
  // Pool + elimination
  pools?: Pool[];
  eliminationMatches?: string[];
  eliminationUnlocked?: boolean;
  // Team
  teamMatchups?: TeamMatchup[];
}

export interface BracketOptions {
  seeding?: boolean;
  pointsForWin?: number;
  pointsForDraw?: number;
  athletesPerPool?: number;
  matchByWeight?: boolean;
}

export interface Referee {
  id: string;
  name: string;
  role: RefRole;
  country: string;
  grade: string;
  status: RefStatus;
  currentMatchId?: string;
  currentAssignment?: string;
}

export interface RoundEvent {
  id: string;
  timestamp: string;
  type: RoundEventType;
  corner?: 'RED' | 'BLUE';
  details: string;
}

export interface JudgeScore {
  judgeId: string;
  judgeName: string;
  matchId: string;
  round: number;
  redScore: number;
  blueScore: number;
  submitted: boolean;
}

export interface TournamentReport {
  id: string;
  matchId: string;
  type: 'Match Report' | 'Judge Scorecard';
  title: string;
  generatedAt: string;
  status: ReportStatus;
  matchData: Match;
  judgeScores: JudgeScore[];
  events: RoundEvent[];
}

export interface TournamentSettings {
  tournamentName: string;
  venue: string;
  startDate: string;
  defaultJudgesCount: 3 | 5;
  roundDurations: Record<AgeGroup, number>;
  language: 'en' | 'fr' | 'ar';
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}
