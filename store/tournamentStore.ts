import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { ref, set, update, push } from 'firebase/database';
import { db } from '@/lib/firebase';
import type {
  Athlete, Club, WeighinRecord, Match, Bracket, Referee,
  RoundEvent, JudgeScore, TournamentReport, MatchResult,
  TournamentSettings, AgeGroup, Gender, TimerMode, WeighinStatus, AppNotification,
  BracketOptions, Pool, TeamMatchup, Standing, BracketFormat, RoleAccount,
} from '@/types/tournament';
import {
  buildSingleElimination, buildSixPlayerElimination, buildDoubleElimination, buildRoundRobin,
  computeStandings, splitIntoPools, shuffle,
} from "@/lib/bracketGenerators";
import { v4 as uuid } from "uuid";
import {
  formatMatchCategory,
  getRoundDuration,
  normalizeAgeGroup,
  parseCategoryId,
  totalRoundsForAgeGroup,
} from "@/lib/ageCategories";
import { DEFAULT_ROLE_ACCOUNTS, makeUsername } from "@/lib/roleAccess";

// ─── Firebase Sync Helpers ────────────────────────────────────────────────────

const fbPath = (path: string) => ref(db, `tournament/${path}`);

function syncToFirebase(path: string, data: unknown) {
  try { set(fbPath(path), data); } catch (e) { console.warn('[FB sync]', path, e); }
}

function pushToFirebase(path: string, data: Record<string, unknown>) {
  try { const r = push(fbPath(path)); set(r, { ...data, id: r.key ?? crypto.randomUUID() }); } catch (e) { console.warn('[FB push]', path, e); }
}

function patchFirebase(path: string, data: Record<string, unknown>) {
  try { update(fbPath(path), data); } catch (e) { console.warn('[FB patch]', path, e); }
}

// ─── Default Settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: TournamentSettings = {
  tournamentName: 'IKF World Championship 2026',
  venue: 'Tunis Arena, Tunisia',
  startDate: '2026-06-10',
  defaultJudgesCount: 3,
  roundDurations: {
    'Mini': 60, 'Cadet': 90, 'Junior': 120, 'Senior': 180,
  },
  language: 'en',
};

const nowIso = () => new Date().toISOString();

function passwordFromId(prefix: string, id: string) {
  return `${prefix}-${id.replace(/-/g, "").slice(0, 6) || "000000"}`;
}

function accountRoleForReferee(role: Referee["role"]): RoleAccount["role"] {
  return role === "Corner Judge" ? "corner-referee" : "central-referee";
}

function makeRefereeAccount(referee: Referee, existingAccounts: RoleAccount[]): RoleAccount {
  const role = accountRoleForReferee(referee.role);
  const prefix = role === "corner-referee" ? "corner" : "central";
  const baseUsername = makeUsername(referee.name, prefix);
  let username = baseUsername;
  let index = 2;
  const taken = new Set(existingAccounts.map(account => account.username.toLowerCase()));
  while (taken.has(username.toLowerCase())) {
    username = `${baseUsername}${index}`;
    index += 1;
  }
  return {
    id: `account-${referee.id}`,
    username,
    password: passwordFromId(prefix, referee.id),
    role,
    displayName: referee.name,
    approvalStatus: referee.approvalStatus ?? "Approved",
    refereeId: referee.id,
    createdAt: nowIso(),
    ...(referee.approvalStatus === "Pending" ? {} : { approvedAt: nowIso() }),
  };
}

// ─── Store Interface ─────────────────────────────────────────────────────────

interface TournamentStore {
  // Role accounts
  accounts: RoleAccount[];
  addAccount: (account: RoleAccount) => void;
  updateAccount: (id: string, data: Partial<RoleAccount>) => void;

  // Settings
  settings: TournamentSettings;
  updateSettings: (data: Partial<TournamentSettings>) => void;

  // Athletes
  athletes: Athlete[];
  addAthlete: (a: Athlete) => void;
  updateAthlete: (id: string, data: Partial<Athlete>) => void;
  approveAthlete: (id: string) => void;
  deleteAthlete: (id: string) => void;

  // Clubs
  clubs: Club[];
  addClub: (c: Club) => void;
  updateClub: (id: string, data: Partial<Club>) => void;
  approveClub: (id: string) => void;
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
  generateFightOrder: (ageGroup: AgeGroup, weightCategory: string, gender?: Gender) => void;
  deleteBracket: (bracketId: string) => void;
  updateMatchResult: (matchId: string, result: MatchResult) => void;
  advanceWinner: (matchId: string, winnerId: string, winnerName: string) => void;
  confirmBracketWinner: (matchId: string, winnerCorner: 'RED' | 'BLUE') => void;
  updateRoundRobinStandings: (bracketId: string) => void;
  advancePoolWinners: (bracketId: string) => void;
  updateTeamScore: (teamMatchupId: string) => void;

  // Referees
  referees: Referee[];
  addReferee: (r: Referee) => void;
  updateReferee: (id: string, data: Partial<Referee>) => void;
  approveReferee: (id: string) => void;
  deleteReferee: (id: string) => void;
  assignRefereeToMatch: (matchId: string, refereeId: string, judgeIds: string[], scheduledTime?: string) => void;

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
  validateResult: (matchId: string, judgeIds: string[], sourceScores?: JudgeScore[], sourceEvents?: RoundEvent[]) => void;
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

// ─── Store Implementation (no localStorage, Firebase-backed) ─────────────────

export const useTournamentStore = create<TournamentStore>()((set, get) => ({
  accounts: DEFAULT_ROLE_ACCOUNTS,
  addAccount: (account) => {
    set(s => {
      const exists = s.accounts.some(existing =>
        existing.id === account.id ||
        existing.username.trim().toLowerCase() === account.username.trim().toLowerCase()
      );
      return { accounts: exists ? s.accounts : [account, ...s.accounts] };
    });
    syncToFirebase('accounts', get().accounts);
  },
  updateAccount: (id, data) => {
    set(s => ({
      accounts: s.accounts.map(account => account.id === id ? { ...account, ...data } : account),
    }));
    syncToFirebase('accounts', get().accounts);
  },

  settings: DEFAULT_SETTINGS,
  updateSettings: (data) => {
    set(s => ({ settings: { ...s.settings, ...data } }));
    syncToFirebase('settings', get().settings);
  },
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
  athletes: [],
  addAthlete: (a) => {
    const approvalStatus = a.approvalStatus ?? "Approved";
    const readyAthlete: Athlete = {
      ...a,
      ageGroup: normalizeAgeGroup(a.ageGroup),
      approvalStatus,
      weighInStatus: a.weighInStatus ?? 'Confirmed',
      registrationStatus: a.registrationStatus ?? (approvalStatus === "Approved" ? 'Active' : 'Pending'),
    };
    set(s => ({ athletes: [readyAthlete, ...s.athletes] }));
    syncToFirebase('athletes', get().athletes);
    get().addNotification("New Athlete Registered", `${readyAthlete.fullName} added to ${readyAthlete.weightCategory}${approvalStatus === "Pending" ? " and is waiting for approval" : ""}`);
    toast.success(
      approvalStatus === "Pending"
        ? `Athlete ${readyAthlete.fullName} submitted for admin approval`
        : `Athlete ${readyAthlete.fullName} registered successfully`,
      { style: { background: approvalStatus === "Pending" ? '#d4a017' : '#27ae60', color: approvalStatus === "Pending" ? '#000' : '#fff' } },
    );
  },
  updateAthlete: (id, data) => {
    set(s => ({
      athletes: s.athletes.map(a => a.id === id ? { ...a, ...data } : a)
    }));
    syncToFirebase('athletes', get().athletes);
  },
  approveAthlete: (id) => {
    const athlete = get().athletes.find(a => a.id === id);
    set(s => ({
      athletes: s.athletes.map(a => a.id === id ? { ...a, approvalStatus: "Approved", registrationStatus: "Active", approvedAt: nowIso() } : a),
      accounts: s.accounts.map(account => account.athleteId === id || account.id === athlete?.accountId ? { ...account, athleteId: id, displayName: athlete?.fullName ?? account.displayName, approvalStatus: "Approved", approvedAt: nowIso() } : account),
    }));
    syncToFirebase('athletes', get().athletes);
    syncToFirebase('accounts', get().accounts);
    if (athlete) get().addNotification("Athlete Approved", `${athlete.fullName} can now appear in brackets, TV lists, and match assignment data.`);
    toast.success("Athlete approved");
  },
  deleteAthlete: (id) => set(s => {
    const matchIds = new Set(s.matches.filter(m => m.redCornerId === id || m.blueCornerId === id).map(m => m.id));
    const next = {
      athletes: s.athletes.filter(a => a.id !== id),
      accounts: s.accounts.map(account => account.athleteId === id ? { ...account, athleteId: undefined } : account),
      weighinRecords: s.weighinRecords.filter(r => r.athleteId !== id),
      matches: s.matches.filter(m => !matchIds.has(m.id)),
      judgeScores: s.judgeScores.filter(score => !matchIds.has(score.matchId)),
    };
    syncToFirebase('athletes', next.athletes);
    syncToFirebase('accounts', next.accounts);
    syncToFirebase('matches', next.matches);
    return next;
  }),

  // ── Clubs ──
  clubs: [],
  addClub: (c) => {
    const approvalStatus = c.approvalStatus ?? (c.status === "Pending" ? "Pending" : "Approved");
    const club: Club = {
      ...c,
      approvalStatus,
      status: c.status ?? (approvalStatus === "Approved" ? "Active" : "Pending"),
    };
    set(s => ({ clubs: [club, ...s.clubs] }));
    syncToFirebase('clubs', get().clubs);
    get().addNotification("New Club Registered", `${club.name} (${club.country}) ${approvalStatus === "Pending" ? "is waiting for approval." : "joined the tournament."}`);
    toast.success(
      approvalStatus === "Pending" ? `Club ${club.name} submitted for admin approval` : `Club ${club.name} registered successfully`,
      { style: { background: approvalStatus === "Pending" ? '#d4a017' : '#27ae60', color: approvalStatus === "Pending" ? '#000' : '#fff' } },
    );
  },
  updateClub: (id, data) => {
    set(s => ({
      clubs: s.clubs.map(c => c.id === id ? { ...c, ...data } : c)
    }));
    syncToFirebase('clubs', get().clubs);
  },
  approveClub: (id) => {
    const club = get().clubs.find(c => c.id === id);
    set(s => ({
      clubs: s.clubs.map(c => c.id === id ? { ...c, approvalStatus: "Approved", status: "Active", approvedAt: nowIso() } : c),
      accounts: s.accounts.map(account => account.clubId === id || account.id === club?.accountId ? { ...account, clubId: id, displayName: club?.name ?? account.displayName, approvalStatus: "Approved", approvedAt: nowIso() } : account),
    }));
    syncToFirebase('clubs', get().clubs);
    syncToFirebase('accounts', get().accounts);
    if (club) get().addNotification("Club Approved", `${club.name} can now appear in public TV lists and athlete registration.`);
    toast.success("Club approved");
  },
  deleteClub: (id) => set(s => {
    const athleteIds = new Set(s.athletes.filter(a => a.clubId === id).map(a => a.id));
    const matchIds = new Set(s.matches.filter(m => athleteIds.has(m.redCornerId) || athleteIds.has(m.blueCornerId)).map(m => m.id));
    const next = {
      clubs: s.clubs.filter(c => c.id !== id),
      accounts: s.accounts.map(account => account.clubId === id ? { ...account, clubId: undefined } : account),
      athletes: s.athletes.filter(a => a.clubId !== id),
      weighinRecords: s.weighinRecords.filter(r => !athleteIds.has(r.athleteId)),
      matches: s.matches.filter(m => !matchIds.has(m.id)),
      judgeScores: s.judgeScores.filter(score => !matchIds.has(score.matchId)),
    };
    syncToFirebase('clubs', next.clubs);
    syncToFirebase('accounts', next.accounts);
    syncToFirebase('athletes', next.athletes);
    syncToFirebase('matches', next.matches);
    return next;
  }),

  // ── Weigh-in ──
  weighinRecords: [],
  addWeighinRecord: (r) => {
    set(s => ({ weighinRecords: [r, ...s.weighinRecords] }));
    syncToFirebase('weighinRecords', get().weighinRecords);
  },
  updateAthleteWeighinStatus: (athleteId, status, newCategory) => {
    set(s => ({
      athletes: s.athletes.map(a =>
        a.id === athleteId
          ? { ...a, weighInStatus: status, ...(newCategory ? { weightCategory: newCategory } : {}) }
          : a
      )
    }));
    syncToFirebase('athletes', get().athletes);
  },

  // ── Matches & Brackets ──
  matches: [],
  brackets: [],
  addMatch: (m) => {
    set(s => ({ matches: [...s.matches, { ...m, totalRounds: 3 }] }));
    syncToFirebase('matches', get().matches);
    toast.success("Match saved successfully", { style: { background: '#27ae60', color: '#fff' } });
  },
  updateMatch: (id, data) => {
    let updatedMatch: Match | undefined;
    set(s => {
      const current = s.matches.find(m => m.id === id);
      const completed = data.status === 'completed';
      const started = data.status === 'in-progress';
      const assignedIds = current ? [current.assignedRefereeId, ...(current.assignedJudgeIds ?? [])].filter(Boolean) as string[] : [];
      updatedMatch = current ? { ...current, ...data, totalRounds: 3 } as Match : undefined;
      return {
        matches: s.matches.map(m => m.id === id ? { ...m, ...data, totalRounds: 3 } : m),
        activeMatch: s.activeMatch?.id === id ? { ...s.activeMatch, ...data, totalRounds: 3 } as Match : s.activeMatch,
        referees: completed
          ? s.referees.map(r => assignedIds.includes(r.id) ? { ...r, status: 'Available', currentMatchId: undefined, currentAssignment: undefined } : r)
          : started
            ? s.referees.map(r => assignedIds.includes(r.id) ? { ...r, status: 'In Match', currentMatchId: id, currentAssignment: `Mat ${current?.matNumber ?? ''} - Match #${current?.matchNumber ?? ''}` } : r)
          : s.referees,
      };
    });
    if (updatedMatch) syncToFirebase(`matches`, get().matches);
    syncToFirebase('referees', get().referees);
    toast.success("Match updated successfully", { style: { background: '#27ae60', color: '#fff' } });
  },

  generateBracket: (categoryId, format, eligibleAthletes, options) => {
    const fmt = format as BracketFormat;
    if (eligibleAthletes.length < 2) {
      toast.error('Not enough athletes — need at least 2 confirmed athletes to generate a bracket');
      return;
    }

    const settings = get().settings;
    const parsedCategory = parseCategoryId(categoryId);
    const ageGroup = normalizeAgeGroup(eligibleAthletes[0]?.ageGroup ?? parsedCategory.ageGroup);
    const weightCategory = eligibleAthletes[0]?.weightCategory ?? parsedCategory.weightCategory;
    const gender = options?.gender ?? eligibleAthletes[0]?.gender ?? parsedCategory.gender;
    if (!gender) {
      toast.error('Select Male or Female before generating a bracket');
      return;
    }
    if (eligibleAthletes.some(a => a.gender !== gender)) {
      toast.error('Male and female athletes cannot be mixed in the same bracket');
      return;
    }
    const baseCategory = formatMatchCategory(ageGroup, weightCategory);
    const category = `${gender} ${baseCategory}`;
    const roundDuration = getRoundDuration(settings.roundDurations, ageGroup);
    const bracketId = uuid();
    const startMatchNumber = get().matches.length + 1;
    const base = {
      category, gender, ageGroup, weightCategory,
      roundDuration, startMatchNumber, startTime: Date.now(), bracketId,
    };

    const seeded = options?.seeding ? [...eligibleAthletes] : shuffle(eligibleAthletes);
    let newMatches: Match[] = [];
    let bracket: Bracket;

    if (fmt === 'single-elimination') {
      const res = seeded.length === 6 ? buildSixPlayerElimination(seeded, base) : buildSingleElimination(seeded, base);
      newMatches = res.matches;
      bracket = {
        id: bracketId, categoryId: category, category, gender, ageGroup, weightCategory,
        format: fmt, status: 'in-progress',
        matchIds: newMatches.map(m => m.id), matches: newMatches.map(m => m.id),
      };
      if (res.byes > 0) toast(`${seeded.length} athletes — ${res.byes} BYEs assigned automatically`, { icon: 'ℹ️' });
    } else if (fmt === 'double-elimination') {
      const res = buildDoubleElimination(seeded, base);
      newMatches = res.matches;
      bracket = {
        id: bracketId, categoryId: category, category, gender, ageGroup, weightCategory,
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
        id: bracketId, categoryId: category, category, gender, ageGroup, weightCategory,
        format: fmt, status: 'in-progress',
        matchIds: newMatches.map(m => m.id), matches: newMatches.map(m => m.id),
        standings: computeStandings(seeded, newMatches, pointsForWin, pointsForDraw),
        pointsForWin, pointsForDraw,
      };
    } else if (fmt === 'pool-elimination') {
      const athletesPerPool = options?.athletesPerPool ?? 4;
      const poolPointsForWin = options?.pointsForWin ?? 3;
      const poolPointsForDraw = options?.pointsForDraw ?? 1;
      const pools = splitIntoPools(seeded, athletesPerPool);
      const poolMatches: Match[] = [];
      const poolObjs: Pool[] = pools.map((pool, idx) => {
        const poolId = `${bracketId}-pool-${idx}`;
        const pm = buildRoundRobin(pool, { ...base, bracketId: poolId, startMatchNumber: startMatchNumber + poolMatches.length });
        poolMatches.push(...pm);
        return {
          id: poolId,
          name: `POOL ${String.fromCharCode(65 + idx)}`,
          athleteIds: pool.map(a => a.id),
          matchIds: pm.map(m => m.id),
          standings: computeStandings(pool, pm, poolPointsForWin, poolPointsForDraw),
          complete: false,
        };
      });
      newMatches = poolMatches;
      bracket = {
        id: bracketId, categoryId: category, category, gender, ageGroup, weightCategory,
        format: fmt, status: 'in-progress',
        matchIds: newMatches.map(m => m.id), matches: newMatches.map(m => m.id),
        pools: poolObjs,
      };
    } else if (fmt === 'team') {
      bracket = {
        id: bracketId, categoryId: category, category, gender, ageGroup, weightCategory,
        format: fmt, status: 'pending',
        matchIds: [], matches: [], teamMatchups: [],
      };
    } else {
      toast.error(`Unknown bracket format: ${format}`);
      return;
    }

    set(s => ({
      matches: [...s.matches, ...newMatches],
      brackets: [...s.brackets, bracket],
    }));

    syncToFirebase('matches', get().matches);
    syncToFirebase('brackets', get().brackets);
    toast.success(`Bracket generated: ${category} (${fmt})`, { style: { background: '#27ae60', color: '#fff' } });
  },

  generateFightOrder: (ageGroup, weightCategory, gender) => {
    const normalizedAgeGroup = normalizeAgeGroup(ageGroup);
    const baseCategory = formatMatchCategory(normalizedAgeGroup, weightCategory);
    const category = gender ? `${gender} ${baseCategory}` : baseCategory;
    const matchBelongsToCategory = (match: Match) =>
      normalizeAgeGroup(match.ageGroup) === normalizedAgeGroup &&
      match.weightCategory === weightCategory &&
      (!gender || match.gender === gender || match.category === category);
    const categoryMatches = get().matches.filter(m => matchBelongsToCategory(m) && m.status === 'scheduled');
    const shuffled = shuffle(categoryMatches);
    set(s => ({
      matches: s.matches.map(m => {
        const idx = shuffled.findIndex(sm => sm.id === m.id);
        if (idx >= 0) return { ...m, matchNumber: s.matches.filter(matchBelongsToCategory).length - idx };
        return m;
      }),
    }));
    syncToFirebase('matches', get().matches);
    toast.success(`Fight order randomized for ${category}`, { style: { background: '#27ae60', color: '#fff' } });
  },

  deleteBracket: (bracketId) => set(s => {
    const bracket = s.brackets.find(b => b.id === bracketId);
    const matchIds = new Set(bracket?.matchIds ?? []);
    const next = {
      brackets: s.brackets.filter(b => b.id !== bracketId),
      matches: s.matches.filter(m => !matchIds.has(m.id)),
    };
    syncToFirebase('brackets', next.brackets);
    syncToFirebase('matches', next.matches);
    return next;
  }),

  updateMatchResult: (matchId, result) => {
    set(s => ({
      matches: s.matches.map(m => m.id === matchId ? { ...m, status: 'completed', result } : m),
      activeMatch: s.activeMatch?.id === matchId ? { ...s.activeMatch, status: 'completed', result } : s.activeMatch,
    }));
    syncToFirebase('matches', get().matches);
  },

  advanceWinner: (matchId, winnerId, winnerName) => {
    const state = get();
    const sourceMatch = state.matches.find(m => m.id === matchId);
    const bracket = state.brackets.find(b => b.matchIds.includes(matchId));
    if (!sourceMatch || !bracket || !winnerId) return;

    const fillTargetSlot = (targetMatchId: string, slot: 'RED' | 'BLUE') => {
      const target = get().matches.find(m => m.id === targetMatchId);
      if (!target) return;
      if (target.status === 'completed') {
        toast.error(`Match #${target.matchNumber} is already completed; advancement was not changed`);
        return;
      }

      set(s => ({
        matches: s.matches.map(m => {
          if (m.id !== targetMatchId) return m;
          return slot === 'RED'
            ? { ...m, redCornerId: winnerId, redCornerName: winnerName, isBye: false }
            : { ...m, blueCornerId: winnerId, blueCornerName: winnerName, isBye: false };
        }),
      }));
      syncToFirebase('matches', get().matches);
    };

    const eventBelongsToMatch = (event: RoundEvent, match: Match) => {
      const details = (event.details ?? '').toLowerCase();
      const matchTag = `match #${match.matchNumber}`;
      return (
        details.includes(matchTag) ||
        details.includes(`#${match.matchNumber} -`) ||
        details.includes(`#${match.matchNumber} —`) ||
        details.endsWith(`#${match.matchNumber}`)
      );
    };

    const countWinnerProblems = (match: Match) => {
      const result = match.result;
      if (!result?.winnerId) {
        return { redCards: 99, yellowCards: 99, deductions: 99, warnings: 99, totalProblems: 999 };
      }
      const cornerText = `${result.winnerCorner.toLowerCase()} corner`;
      const winnerEvents = get().roundEvents.filter(event =>
        eventBelongsToMatch(event, match) &&
        (event.corner === result.winnerCorner || (event.details ?? '').toLowerCase().includes(cornerText))
      );
      const redCards = winnerEvents.filter(event => event.type === 'red-card').length;
      const yellowCards = winnerEvents.filter(event => event.type === 'yellow-card').length;
      const deductions = winnerEvents.filter(event => event.type === 'deduction').length;
      const warnings = winnerEvents.filter(event =>
        event.type !== 'yellow-card' && (event.details ?? '').toLowerCase().includes('warning')
      ).length;

      return {
        redCards,
        yellowCards,
        deductions,
        warnings,
        totalProblems: redCards + yellowCards + deductions + warnings,
      };
    };

    const handleSixPlayerPriority = () => {
      const freshState = get();
      const bracketMatches = freshState.matches.filter(m => bracket.matchIds.includes(m.id));
      const openingMatches = bracketMatches
        .filter(m => m.round === 'Round of 6')
        .sort((a, b) => a.matchNumber - b.matchNumber);
      const semifinal = bracketMatches.find(m => m.round === 'Semifinal');
      const finalMatch = bracketMatches.find(m => m.round === 'Final');
      const sourceIsOpeningMatch = openingMatches.some(m => m.id === matchId);

      if (!sourceIsOpeningMatch || openingMatches.length !== 3 || !semifinal || !finalMatch) return false;

      const openingWinners = openingMatches
        .filter(m => m.status === 'completed' && m.result?.winnerId)
        .map(m => {
          const problems = countWinnerProblems(m);
          return {
            match: m,
            winnerId: m.result!.winnerId,
            winnerName: m.result!.winnerName,
            ...problems,
          };
        });

      if (openingWinners.length < 3) {
        toast.success('Winner recorded. Six-player priority pass will be calculated after all 3 opening matches finish.');
        return true;
      }

      if (semifinal.status === 'completed' || finalMatch.status === 'completed') {
        toast.error('The next six-player stage has already been completed, so the priority mapping was not changed.');
        return true;
      }

      const [priorityWinner, ...semifinalists] = [...openingWinners].sort((a, b) =>
        a.redCards - b.redCards ||
        a.yellowCards - b.yellowCards ||
        a.deductions - b.deductions ||
        a.warnings - b.warnings ||
        a.totalProblems - b.totalProblems ||
        a.match.matchNumber - b.match.matchNumber ||
        a.winnerName.localeCompare(b.winnerName)
      );

      if (!priorityWinner || semifinalists.length < 2) return true;

      set(s => ({
        matches: s.matches.map(m => {
          if (m.id === semifinal.id) {
            return {
              ...m,
              redCornerId: semifinalists[0].winnerId,
              redCornerName: semifinalists[0].winnerName,
              blueCornerId: semifinalists[1].winnerId,
              blueCornerName: semifinalists[1].winnerName,
              isBye: false,
            };
          }
          if (m.id === finalMatch.id) {
            return {
              ...m,
              redCornerId: priorityWinner.winnerId,
              redCornerName: priorityWinner.winnerName,
              blueCornerName: m.blueCornerId ? m.blueCornerName : 'Semifinal winner',
              isBye: false,
            };
          }
          return m;
        }),
      }));
      syncToFirebase('matches', get().matches);

      toast.success(`${priorityWinner.winnerName} advanced automatically by clean-card priority. The other two winners were mapped to the semifinal.`, {
        duration: 6000,
      });
      return true;
    };

    if (sourceMatch.nextMatchId && sourceMatch.nextMatchSlot) {
      fillTargetSlot(sourceMatch.nextMatchId, sourceMatch.nextMatchSlot);
      return;
    }

    if (handleSixPlayerPriority()) return;

    const nextMatch = get().matches.find(m =>
      bracket.matchIds.includes(m.id) &&
      (m.redCornerId === '' || m.blueCornerId === '') &&
      m.id !== matchId &&
      m.status !== 'completed'
    );
    if (nextMatch) {
      fillTargetSlot(nextMatch.id, nextMatch.redCornerId === '' ? 'RED' : 'BLUE');
    }
  },

  confirmBracketWinner: (matchId, winnerCorner) => {
    const match = get().matches.find(m => m.id === matchId);
    if (!match) return;
    if (match.status === 'completed') {
      toast.error('This match already has a confirmed winner');
      return;
    }

    const winnerId = winnerCorner === 'RED' ? match.redCornerId : match.blueCornerId;
    const winnerName = winnerCorner === 'RED' ? match.redCornerName : match.blueCornerName;
    const invalidNames = ['BYE', 'TBD', 'Priority winner', 'Semifinal winner', 'WB Champion', 'LB Champion'];
    if (!winnerId || invalidNames.includes(winnerName)) {
      toast.error('Both fighters must be known before confirming a bracket winner');
      return;
    }

    const result: MatchResult = {
      winnerId,
      winnerName,
      winnerCorner,
      method: 'majority-decision',
      redTotalScore: match.result?.redTotalScore ?? 0,
      blueTotalScore: match.result?.blueTotalScore ?? 0,
      roundScores: match.result?.roundScores ?? [],
      validatedAt: new Date().toISOString(),
    };

    set({ currentResult: result });
    get().addRoundEvent({
      type: 'decision',
      corner: winnerCorner,
      details: `Match #${match.matchNumber} - Bracket winner confirmed for ${winnerName}`,
    });
    get().updateMatchResult(matchId, result);
    get().generateReport(matchId);
    get().advanceWinner(matchId, winnerId, winnerName);
    get().addNotification('Bracket Winner Confirmed', `${winnerName} advanced from Match #${match.matchNumber}`);
    syncToFirebase('results/' + matchId, result);

    toast.success(`${winnerName} confirmed as winner and advanced in the bracket`, {
      duration: 5000,
      style: { background: 'var(--ikf-gold)', color: '#000', fontWeight: 'bold' },
    });
  },

  updateRoundRobinStandings: (bracketId) => {
    const state = get();
    const bracket = state.brackets.find(b => b.id === bracketId);
    if (!bracket) return;
    const bracketMatches = state.matches.filter(m => bracket.matchIds.includes(m.id));
    const standings = computeStandings(
      state.matches.filter(m => bracket.matchIds.includes(m.id)).flatMap(m => [m.redCornerId, m.blueCornerId]).filter(Boolean).map(id => ({ id } as any)),
      bracketMatches,
      bracket.pointsForWin ?? 3,
      bracket.pointsForDraw ?? 1,
    );
    set(s => ({
      brackets: s.brackets.map(b => b.id === bracketId ? { ...b, standings } : b),
    }));
    syncToFirebase('brackets', get().brackets);
  },

  advancePoolWinners: (bracketId) => {
    const state = get();
    const bracket = state.brackets.find(b => b.id === bracketId);
    if (!bracket?.pools) return;
    const eliminationMatches: Match[] = [];
    const poolWinners = bracket.pools.map(pool => {
      const sorted = [...(pool.standings ?? [])].sort((a, b) => b.points - a.points || b.wins - a.wins);
      return sorted[0];
    }).filter(Boolean);

    if (poolWinners.length >= 2) {
      const startNum = state.matches.length + 1;
      for (let i = 0; i < poolWinners.length - 1; i += 2) {
        const w1 = poolWinners[i];
        const w2 = poolWinners[i + 1];
        if (!w1 || !w2) continue;
        const m: Match = {
          id: uuid(), matchNumber: startNum + i / 2, bracketId,
          category: bracket.category ?? '', gender: bracket.gender as Gender | undefined, ageGroup: bracket.ageGroup as AgeGroup ?? 'Senior',
          weightCategory: bracket.weightCategory ?? '', round: 'Semifinal',
          redCornerId: w1.athleteId, blueCornerId: w2.athleteId,
          redCornerName: w1.athleteName, blueCornerName: w2.athleteName,
          matNumber: 1, scheduledTime: null, status: 'scheduled',
          roundDurationSeconds: getRoundDuration(state.settings.roundDurations, bracket.ageGroup as AgeGroup ?? 'Senior'),
          totalRounds: totalRoundsForAgeGroup(bracket.ageGroup as AgeGroup ?? 'Senior'),
        };
        eliminationMatches.push(m);
      }
    }

    set(s => ({
      matches: [...s.matches, ...eliminationMatches],
      brackets: s.brackets.map(b => b.id === bracketId ? {
        ...b,
        eliminationMatches: [...(b.eliminationMatches ?? []), ...eliminationMatches.map(m => m.id)],
        eliminationUnlocked: true,
      } : b),
    }));
    syncToFirebase('matches', get().matches);
    syncToFirebase('brackets', get().brackets);
    toast.success('Pool winners advanced to elimination stage');
  },

  updateTeamScore: (teamMatchupId) => {
    const state = get();
    const matchup = state.brackets.flatMap(b => b.teamMatchups ?? []).find(t => t.id === teamMatchupId);
    if (!matchup) return;
    const individualResults = matchup.individualMatchIds.map(mid => state.matches.find(m => m.id === mid)?.result).filter(Boolean);
    const redWins = individualResults.filter(r => r!.winnerCorner === 'RED').length;
    const blueWins = individualResults.filter(r => r!.winnerCorner === 'BLUE').length;
    set(s => ({
      brackets: s.brackets.map(b => ({
        ...b,
        teamMatchups: (b.teamMatchups ?? []).map(t => t.id === teamMatchupId ? {
          ...t,
          redWins, blueWins,
          status: individualResults.length === matchup.individualMatchIds.length ? 'complete' : 'in-progress',
          winnerId: individualResults.length === matchup.individualMatchIds.length
            ? (redWins > blueWins ? t.redClubId : blueWins > redWins ? t.blueClubId : undefined)
            : undefined,
        } : t),
      })),
    }));
    syncToFirebase('brackets', get().brackets);
  },

  // ── Referees ──
  referees: [],
  addReferee: (r) => {
    const approvalStatus = r.approvalStatus ?? "Approved";
    const referee: Referee = { ...r, approvalStatus };
    let createdAccount: RoleAccount | null = null;
    set(s => {
      const existingLinkedAccount = referee.accountId
        ? s.accounts.find(account => account.id === referee.accountId)
        : null;
      createdAccount = existingLinkedAccount
        ? {
          ...existingLinkedAccount,
          role: accountRoleForReferee(referee.role),
          refereeId: referee.id,
          displayName: referee.name,
          approvalStatus,
          ...(approvalStatus === "Approved" ? { approvedAt: nowIso() } : {}),
        }
        : makeRefereeAccount(referee, s.accounts);
      const linkedReferee = { ...referee, accountId: createdAccount.id };
      return {
        referees: [linkedReferee, ...s.referees],
        accounts: existingLinkedAccount
          ? s.accounts.map(account => account.id === existingLinkedAccount.id ? createdAccount! : account)
          : [createdAccount, ...s.accounts],
      };
    });
    syncToFirebase('referees', get().referees);
    syncToFirebase('accounts', get().accounts);
    const accountForToast = get().accounts.find(account => account.refereeId === r.id || account.id === r.accountId);
    toast.success(
      accountForToast
        ? `Referee ${r.name} added. Login: ${accountForToast.username} / ${accountForToast.password}`
        : `Referee ${r.name} added`,
      { duration: 7000, style: { background: '#27ae60', color: '#fff' } },
    );
  },
  updateReferee: (id, data) => {
    set(s => ({
      referees: s.referees.map(r => r.id === id ? { ...r, ...data } : r)
    }));
    syncToFirebase('referees', get().referees);
  },
  approveReferee: (id) => {
    const referee = get().referees.find(r => r.id === id);
    if (!referee) return;
    const existingAccount = get().accounts.find(account => account.refereeId === id || account.id === referee.accountId);
    set(s => {
      const account = existingAccount ?? makeRefereeAccount({ ...referee, approvalStatus: "Approved" }, s.accounts);
      const nextAccounts = existingAccount
        ? s.accounts.map(existing => existing.id === existingAccount.id ? { ...existing, approvalStatus: "Approved" as const, approvedAt: nowIso(), refereeId: id, displayName: referee.name } : existing)
        : [account, ...s.accounts];
      return {
        referees: s.referees.map(r => r.id === id ? { ...r, approvalStatus: "Approved", approvedAt: nowIso(), accountId: account.id } : r),
        accounts: nextAccounts,
      };
    });
    syncToFirebase('referees', get().referees);
    syncToFirebase('accounts', get().accounts);
    get().addNotification("Referee Approved", `${referee.name} can now log in and judge assigned matches.`);
    toast.success(`${referee.name} approved for judging access`);
  },
  deleteReferee: (id) => {
    set(s => ({
      referees: s.referees.filter(r => r.id !== id),
      accounts: s.accounts.filter(account => account.refereeId !== id),
    }));
    syncToFirebase('referees', get().referees);
    syncToFirebase('accounts', get().accounts);
  },
  assignRefereeToMatch: (matchId, refereeId, judgeIds, scheduledTime) => {
    const officials = get().referees.filter(r => r.id === refereeId || judgeIds.includes(r.id));
    if (officials.some(official => (official.approvalStatus ?? "Approved") !== "Approved")) {
      toast.error("Only approved officials can be assigned to a match");
      return;
    }
    set(s => ({
      matches: s.matches.map(m => m.id === matchId ? {
        ...m,
        assignedRefereeId: refereeId,
        assignedJudgeIds: judgeIds,
        ...(scheduledTime ? { scheduledTime } : {}),
      } : m),
      referees: s.referees.map(r =>
        r.id === refereeId || judgeIds.includes(r.id)
          ? { ...r, currentMatchId: matchId, currentAssignment: `Match #${s.matches.find(m => m.id === matchId)?.matchNumber ?? '?'}` }
          : r
      ),
    }));
    syncToFirebase('matches', get().matches);
    syncToFirebase('referees', get().referees);
    toast.success('Officials assigned to match');
  },

  // ── Active Match & Round State ──
  activeMatch: null,
  setActiveMatch: (m) => {
    const nextMatch = m ? { ...m, totalRounds: 3 } : null;
    set({ activeMatch: nextMatch });
    if (nextMatch) syncToFirebase('activeMatch', nextMatch);
  },
  currentRound: 1,
  setCurrentRound: (r) => {
    set({ currentRound: r });
    patchFirebase('live/matchState', { currentRound: r, activeMatch: get().activeMatch, updatedAt: Date.now() });
  },
  roundTimer: 180,
  setRoundTimer: (t) => {
    set({ roundTimer: t });
    patchFirebase('live/matchState', { roundTimer: t, activeMatch: get().activeMatch, currentRound: get().currentRound, updatedAt: Date.now() });
  },
  timerMode: 'idle',
  setTimerMode: (mode) => {
    set({ timerMode: mode });
    patchFirebase('live/matchState', { timerMode: mode, activeMatch: get().activeMatch, currentRound: get().currentRound, roundTimer: get().roundTimer, updatedAt: Date.now() });
  },
  roundEvents: [],
  addRoundEvent: (e) => {
    const newEvent = { ...e, id: uuidv4(), timestamp: new Date().toISOString() } as RoundEvent;
    set(s => ({ roundEvents: [...s.roundEvents, newEvent] }));
    pushToFirebase('events', newEvent as unknown as Record<string, unknown>);
  },
  clearRoundEvents: () => set({ roundEvents: [] }),

  // ── Judging ──
  judgeScores: [],
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
    syncToFirebase(`judging/${matchId}/scores/${judgeId}/rounds/${round}`, { ...score, updatedAt: new Date().toISOString(), validationStatus: 'submitted' });
    toast.success(`${judgeName} — Round ${round} score submitted`, { duration: 3000 });
  },

  currentResult: null,

  validateResult: (matchId, judgeIds, sourceScores, sourceEvents) => {
    const state = get();
    const scores = (sourceScores ?? state.judgeScores).filter(s => s.matchId === matchId && s.submitted);
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    // Check for live method events first (Decision, KO/TKO, Ippon, Disqualification, Draw).
    const matchEvents = (sourceEvents ?? state.roundEvents).filter(e =>
      e.details?.includes(`#${match.matchNumber}`) || e.details?.toLowerCase().includes(`match #${match.matchNumber}`)
    );
    const decisiveEvents = matchEvents.filter(e =>
      ['decision', 'ko-tko', 'ippon-result', 'disqualification', 'draw'].includes(e.type)
    );
    const lastDecisive = decisiveEvents.length > 0 ? decisiveEvents[decisiveEvents.length - 1] : null;

    let result: MatchResult;

    if (lastDecisive) {
      // Use the decisive event as the authoritative result
      const method = lastDecisive.type === 'decision' ? 'majority-decision' :
                     lastDecisive.type === 'ko-tko' ? 'KO' :
                     lastDecisive.type === 'ippon-result' ? 'ippon' :
                     lastDecisive.type === 'disqualification' ? 'disqualification' : 'draw';

      const totalRed = scores.reduce((a, s) => a + s.redScore, 0);
      const totalBlue = scores.reduce((a, s) => a + s.blueScore, 0);

      if (method === 'draw') {
        result = {
          winnerId: '', winnerName: 'Draw', winnerCorner: 'RED', method: 'draw',
          redTotalScore: totalRed, blueTotalScore: totalBlue,
          roundScores: scores, validatedAt: new Date().toISOString(),
        };
      } else {
        const winnerCorner = lastDecisive.corner ?? (totalRed >= totalBlue ? 'RED' : 'BLUE');
        const winnerId = winnerCorner === 'RED' ? match.redCornerId : match.blueCornerId;
        const winnerName = winnerCorner === 'RED' ? match.redCornerName : match.blueCornerName;
        result = {
          winnerId, winnerName, winnerCorner, method,
          redTotalScore: totalRed, blueTotalScore: totalBlue,
          roundScores: scores, validatedAt: new Date().toISOString(),
        };
      }
    } else {
      // Fallback: score-based majority/unanimous/split decision
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

      result = {
        winnerId, winnerName, winnerCorner, method,
        redTotalScore: totalRed, blueTotalScore: totalBlue,
        roundScores: scores, validatedAt: new Date().toISOString(),
      };
    }

    if (sourceScores || sourceEvents) {
      set(s => {
        const scoreMap = new Map<string, JudgeScore>();
        s.judgeScores.forEach(score => scoreMap.set(`${score.matchId}-${score.judgeId}-${score.round}`, score));
        (sourceScores ?? []).forEach(score => scoreMap.set(`${score.matchId}-${score.judgeId}-${score.round}`, score));

        const eventMap = new Map<string, RoundEvent>();
        s.roundEvents.forEach(event => eventMap.set(event.id || `${event.timestamp}-${event.type}-${event.details}`, event));
        (sourceEvents ?? []).forEach(event => eventMap.set(event.id || `${event.timestamp}-${event.type}-${event.details}`, event));

        return {
          judgeScores: Array.from(scoreMap.values()),
          roundEvents: Array.from(eventMap.values()),
        };
      });
    }

    set({ currentResult: result });
    get().updateMatchResult(matchId, result);
    get().generateReport(matchId);
    if (result.winnerId) get().advanceWinner(matchId, result.winnerId, result.winnerName);
    get().addRoundEvent({ type: 'match-end', details: `${result.winnerName} wins by ${result.method}` });
    get().addNotification("Match Result Validated", `${result.winnerName} won by ${result.method}`);

    syncToFirebase('results/' + matchId, result);

    toast.success(`Result VALIDATED — ${result.winnerName} (${result.winnerCorner}) wins by ${result.method}`, {
      duration: 6000,
      style: { background: 'var(--ikf-gold)', color: '#000', fontWeight: 'bold' }
    });
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
    get().generateReport(matchId);
    get().advanceWinner(matchId, winnerId, winnerName);
    get().addRoundEvent({ type: 'match-end', corner: winnerCorner, details: `OVERRIDE — ${winnerName} wins. Reason: ${reason}` });

    syncToFirebase('results/' + matchId, result);

    toast(`Result OVERRIDDEN — ${winnerName} declared winner`, {
      duration: 6000,
      icon: '⚖️',
      style: { background: 'var(--ikf-gold)', color: '#000', fontWeight: 'bold' }
    });
  },

  clearJudgeScores: (matchId) => set(s => ({
    judgeScores: s.judgeScores.filter(js => js.matchId !== matchId),
    currentResult: null,
  })),

  // ── Reports ──
  reports: [],
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
    syncToFirebase('reports', get().reports);
  },

  updateReportStatus: (reportId, status) => {
    set(s => ({
      reports: s.reports.map(r => r.id === reportId ? { ...r, status } : r)
    }));
    syncToFirebase('reports', get().reports);
  },
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
