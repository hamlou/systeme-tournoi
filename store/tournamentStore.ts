import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { ref, set, update, push } from 'firebase/database';
import { db } from '@/lib/firebase';
import type {
  Athlete, Club, WeighinRecord, Match, Bracket, Referee,
  RoundEvent, JudgeScore, TournamentReport, MatchResult,
  TournamentSettings, AgeGroup, TimerMode, WeighinStatus, AppNotification,
  BracketOptions, Pool, TeamMatchup, Standing, BracketFormat,
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
  generateFightOrder: (ageGroup: AgeGroup, weightCategory: string) => void;
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
    const readyAthlete: Athlete = { ...a, ageGroup: normalizeAgeGroup(a.ageGroup), weighInStatus: 'Confirmed', registrationStatus: 'Active' };
    set(s => ({ athletes: [readyAthlete, ...s.athletes] }));
    syncToFirebase('athletes', get().athletes);
    get().addNotification("New Athlete Registered", `${readyAthlete.fullName} added to ${readyAthlete.weightCategory}`);
    toast.success(`Athlete ${readyAthlete.fullName} registered successfully`, { style: { background: '#27ae60', color: '#fff' } });
  },
  updateAthlete: (id, data) => {
    set(s => ({
      athletes: s.athletes.map(a => a.id === id ? { ...a, ...data } : a)
    }));
    syncToFirebase('athletes', get().athletes);
  },
  deleteAthlete: (id) => set(s => {
    const matchIds = new Set(s.matches.filter(m => m.redCornerId === id || m.blueCornerId === id).map(m => m.id));
    const next = {
      athletes: s.athletes.filter(a => a.id !== id),
      weighinRecords: s.weighinRecords.filter(r => r.athleteId !== id),
      matches: s.matches.filter(m => !matchIds.has(m.id)),
      judgeScores: s.judgeScores.filter(score => !matchIds.has(score.matchId)),
    };
    syncToFirebase('athletes', next.athletes);
    syncToFirebase('matches', next.matches);
    return next;
  }),

  // ── Clubs ──
  clubs: [],
  addClub: (c) => {
    set(s => ({ clubs: [c, ...s.clubs] }));
    syncToFirebase('clubs', get().clubs);
    get().addNotification("New Club Registered", `${c.name} (${c.country}) joined the tournament.`);
    toast.success(`Club ${c.name} registered successfully`, { style: { background: '#27ae60', color: '#fff' } });
  },
  updateClub: (id, data) => {
    set(s => ({
      clubs: s.clubs.map(c => c.id === id ? { ...c, ...data } : c)
    }));
    syncToFirebase('clubs', get().clubs);
  },
  deleteClub: (id) => set(s => {
    const athleteIds = new Set(s.athletes.filter(a => a.clubId === id).map(a => a.id));
    const matchIds = new Set(s.matches.filter(m => athleteIds.has(m.redCornerId) || athleteIds.has(m.blueCornerId)).map(m => m.id));
    const next = {
      clubs: s.clubs.filter(c => c.id !== id),
      athletes: s.athletes.filter(a => a.clubId !== id),
      weighinRecords: s.weighinRecords.filter(r => !athleteIds.has(r.athleteId)),
      matches: s.matches.filter(m => !matchIds.has(m.id)),
      judgeScores: s.judgeScores.filter(score => !matchIds.has(score.matchId)),
    };
    syncToFirebase('clubs', next.clubs);
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
    set(s => ({ matches: [...s.matches, m] }));
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
      updatedMatch = current ? { ...current, ...data } as Match : undefined;
      return {
        matches: s.matches.map(m => m.id === id ? { ...m, ...data } : m),
        activeMatch: s.activeMatch?.id === id ? { ...s.activeMatch, ...data } as Match : s.activeMatch,
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
    const category = formatMatchCategory(ageGroup, weightCategory);
    const roundDuration = getRoundDuration(settings.roundDurations, ageGroup);
    const bracketId = uuid();
    const startMatchNumber = get().matches.length + 1;
    const base = {
      category, ageGroup, weightCategory,
      roundDuration, startMatchNumber, startTime: Date.now(), bracketId,
    };

    const seeded = options?.seeding ? [...eligibleAthletes] : shuffle(eligibleAthletes);
    let newMatches: Match[] = [];
    let bracket: Bracket;

    if (fmt === 'single-elimination') {
      const res = seeded.length === 6 ? buildSixPlayerElimination(seeded, base) : buildSingleElimination(seeded, base);
      newMatches = res.matches;
      bracket = {
        id: bracketId, categoryId: category, category, ageGroup, weightCategory,
        format: fmt, status: 'in-progress',
        matchIds: newMatches.map(m => m.id), matches: newMatches.map(m => m.id),
      };
      if (res.byes > 0) toast(`${seeded.length} athletes — ${res.byes} BYEs assigned automatically`, { icon: 'ℹ️' });
    } else if (fmt === 'double-elimination') {
      const res = buildDoubleElimination(seeded, base);
      newMatches = res.matches;
      bracket = {
        id: bracketId, categoryId: category, category, ageGroup, weightCategory,
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
        id: bracketId, categoryId: category, category, ageGroup, weightCategory,
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
        id: bracketId, categoryId: category, category, ageGroup, weightCategory,
        format: fmt, status: 'in-progress',
        matchIds: newMatches.map(m => m.id), matches: newMatches.map(m => m.id),
        pools: poolObjs,
      };
    } else if (fmt === 'team') {
      bracket = {
        id: bracketId, categoryId: category, category, ageGroup, weightCategory,
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

  generateFightOrder: (ageGroup, weightCategory) => {
    const category = formatMatchCategory(normalizeAgeGroup(ageGroup), weightCategory);
    const categoryMatches = get().matches.filter(m => m.category === category && m.status === 'scheduled');
    const shuffled = shuffle(categoryMatches);
    set(s => ({
      matches: s.matches.map(m => {
        const idx = shuffled.findIndex(sm => sm.id === m.id);
        if (idx >= 0) return { ...m, matchNumber: s.matches.filter(x => x.category === category).length - idx };
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
    const bracket = state.brackets.find(b => b.matchIds.includes(matchId));
    if (!bracket) return;
    const nextMatch = state.matches.find(m =>
      bracket.matchIds.includes(m.id) &&
      (m.redCornerId === '' || m.blueCornerId === '') &&
      m.id !== matchId
    );
    if (nextMatch) {
      const slot = nextMatch.redCornerId === '' ? 'redCornerId' : 'blueCornerId';
      const nameSlot = slot === 'redCornerId' ? 'redCornerName' : 'blueCornerName';
      set(s => ({
        matches: s.matches.map(m => m.id === nextMatch.id ? { ...m, [slot]: winnerId, [nameSlot]: winnerName } : m),
      }));
      syncToFirebase('matches', get().matches);
    }
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
          category: bracket.category ?? '', ageGroup: bracket.ageGroup as AgeGroup ?? 'Senior',
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
    set(s => ({ referees: [r, ...s.referees] }));
    syncToFirebase('referees', get().referees);
    toast.success(`Referee ${r.name} added`, { style: { background: '#27ae60', color: '#fff' } });
  },
  updateReferee: (id, data) => {
    set(s => ({
      referees: s.referees.map(r => r.id === id ? { ...r, ...data } : r)
    }));
    syncToFirebase('referees', get().referees);
  },
  deleteReferee: (id) => {
    set(s => ({ referees: s.referees.filter(r => r.id !== id) }));
    syncToFirebase('referees', get().referees);
  },
  assignRefereeToMatch: (matchId, refereeId, judgeIds, scheduledTime) => {
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
    set({ activeMatch: m });
    if (m) syncToFirebase('activeMatch', m);
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
