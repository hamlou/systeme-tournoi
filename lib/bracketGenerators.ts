import { v4 as uuidv4 } from 'uuid';
import type { Athlete, Match, Standing, AgeGroup } from '@/types/tournament';
import { totalRoundsForAgeGroup } from '@/lib/ageCategories';

// ─── Shared helpers ──────────────────────────────────────────────────────────

export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function nextPowerOfTwo(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
}

export function roundNamesForSize(size: number): string[] {
  // size = number of athlete slots in round 1 (power of 2)
  const names: string[] = [];
  let remaining = size;
  while (remaining > 1) {
    if (remaining === 2) names.push('Final');
    else if (remaining === 4) names.push('Semifinal');
    else if (remaining === 8) names.push('Quarterfinal');
    else names.push(`Round of ${remaining}`);
    remaining = remaining / 2;
  }
  return names;
}

interface BaseMatchInput {
  category: string;
  ageGroup: AgeGroup;
  weightCategory: string;
  roundDuration: number;
  startMatchNumber: number;
  startTime: number; // epoch ms
  bracketId: string;
}

function emptyResultFor(winnerId: string, winnerName: string, corner: 'RED' | 'BLUE'): Match['result'] {
  return {
    winnerId, winnerName, winnerCorner: corner, method: 'withdrawal',
    redTotalScore: 0, blueTotalScore: 0, roundScores: [],
    validatedAt: new Date().toISOString(),
  };
}

// ─── Single Elimination ──────────────────────────────────────────────────────

export interface SingleElimResult {
  matches: Match[];
  byes: number;
}

export function buildSingleElimination(athletes: Athlete[], base: BaseMatchInput): SingleElimResult {
  const size = nextPowerOfTwo(athletes.length);
  const byes = size - athletes.length;
  const roundNames = roundNamesForSize(size);
  const totalRounds = totalRoundsForAgeGroup(base.ageGroup);

  // Athletes with byes are placed at the bottom: real athletes first, then nulls.
  const slots: (Athlete | null)[] = [...athletes, ...Array.from({ length: byes }, () => null)];

  const allMatches: Match[] = [];
  let matchNumber = base.startMatchNumber;
  const now = base.startTime;

  // Round 1
  const firstRoundCount = size / 2;
  const roundMatchIdsByRound: string[][] = [];
  const firstRoundIds: string[] = [];

  for (let i = 0; i < firstRoundCount; i++) {
    const red = slots[i * 2];
    const blue = slots[i * 2 + 1];
    const id = uuidv4();
    firstRoundIds.push(id);
    const isBye = !red || !blue;
    const match: Match = {
      id, matchNumber: matchNumber++, bracketId: base.bracketId,
      category: base.category, ageGroup: base.ageGroup, weightCategory: base.weightCategory,
      round: roundNames[0],
      redCornerId: red?.id ?? '', blueCornerId: blue?.id ?? '',
      redCornerName: red?.fullName ?? 'BYE', blueCornerName: blue?.fullName ?? 'BYE',
      matNumber: (i % 3) + 1,
      scheduledTime: new Date(now + i * 20 * 60000).toISOString(),
      status: isBye && (red || blue) ? 'completed' : 'scheduled',
      roundDurationSeconds: base.roundDuration, totalRounds,
      bracketType: 'winners',
      isBye,
    };
    if (isBye && red) match.result = emptyResultFor(red.id, red.fullName, 'RED');
    if (isBye && !red && blue) match.result = emptyResultFor(blue.id, blue.fullName, 'BLUE');
    allMatches.push(match);
  }
  roundMatchIdsByRound.push(firstRoundIds);

  // Subsequent rounds (empty placeholders)
  for (let r = 1; r < roundNames.length; r++) {
    const prevIds = roundMatchIdsByRound[r - 1];
    const count = prevIds.length / 2;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = uuidv4();
      ids.push(id);
      allMatches.push({
        id, matchNumber: matchNumber++, bracketId: base.bracketId,
        category: base.category, ageGroup: base.ageGroup, weightCategory: base.weightCategory,
        round: roundNames[r],
        redCornerId: '', blueCornerId: '', redCornerName: 'TBD', blueCornerName: 'TBD',
        matNumber: (i % 3) + 1,
        scheduledTime: new Date(now + (firstRoundCount + i) * 20 * 60000).toISOString(),
        status: 'scheduled', roundDurationSeconds: base.roundDuration, totalRounds,
        bracketType: 'winners',
      });
    }
    roundMatchIdsByRound.push(ids);
  }

  // Wire feed-forward (winner of match i in round r -> match floor(i/2) in round r+1)
  for (let r = 0; r < roundMatchIdsByRound.length - 1; r++) {
    const ids = roundMatchIdsByRound[r];
    for (let i = 0; i < ids.length; i++) {
      const m = allMatches.find(x => x.id === ids[i])!;
      const nextId = roundMatchIdsByRound[r + 1][Math.floor(i / 2)];
      m.nextMatchId = nextId;
      m.nextMatchSlot = i % 2 === 0 ? 'RED' : 'BLUE';
    }
  }

  // Auto-advance byes into round 2 immediately.
  for (const m of allMatches) {
    if (m.isBye && m.result && m.nextMatchId) {
      const next = allMatches.find(x => x.id === m.nextMatchId)!;
      if (m.nextMatchSlot === 'RED') { next.redCornerId = m.result.winnerId; next.redCornerName = m.result.winnerName; }
      else { next.blueCornerId = m.result.winnerId; next.blueCornerName = m.result.winnerName; }
    }
  }

  return { matches: allMatches, byes };
}

export function buildSixPlayerElimination(athletes: Athlete[], base: BaseMatchInput): SingleElimResult {
  const totalRounds = totalRoundsForAgeGroup(base.ageGroup);
  const allMatches: Match[] = [];
  let matchNumber = base.startMatchNumber;
  const now = base.startTime;

  const openingMatchIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const red = athletes[i * 2];
    const blue = athletes[i * 2 + 1];
    const id = uuidv4();
    openingMatchIds.push(id);
    allMatches.push({
      id, matchNumber: matchNumber++, bracketId: base.bracketId,
      category: base.category, ageGroup: base.ageGroup, weightCategory: base.weightCategory,
      round: 'Round of 6',
      redCornerId: red.id, blueCornerId: blue.id,
      redCornerName: red.fullName, blueCornerName: blue.fullName,
      matNumber: (i % 3) + 1,
      scheduledTime: new Date(now + i * 20 * 60000).toISOString(),
      status: 'scheduled',
      roundDurationSeconds: base.roundDuration, totalRounds,
      bracketType: 'winners',
    });
  }

  const semifinalId = uuidv4();
  const finalId = uuidv4();

  allMatches.push({
    id: semifinalId, matchNumber: matchNumber++, bracketId: base.bracketId,
    category: base.category, ageGroup: base.ageGroup, weightCategory: base.weightCategory,
    round: 'Semifinal',
    redCornerId: '', blueCornerId: '',
    redCornerName: 'TBD', blueCornerName: 'TBD',
    matNumber: 1,
    scheduledTime: new Date(now + 3 * 20 * 60000).toISOString(),
    status: 'scheduled',
    roundDurationSeconds: base.roundDuration, totalRounds,
    bracketType: 'winners',
    nextMatchId: finalId,
    nextMatchSlot: 'BLUE',
  });

  allMatches.push({
    id: finalId, matchNumber: matchNumber++, bracketId: base.bracketId,
    category: base.category, ageGroup: base.ageGroup, weightCategory: base.weightCategory,
    round: 'Final',
    redCornerId: '', blueCornerId: '',
    redCornerName: 'Priority winner', blueCornerName: 'Semifinal winner',
    matNumber: 1,
    scheduledTime: new Date(now + 4 * 20 * 60000).toISOString(),
    status: 'scheduled',
    roundDurationSeconds: base.roundDuration, totalRounds,
    bracketType: 'winners',
  });

  return { matches: allMatches, byes: 0 };
}

// ─── Double Elimination ──────────────────────────────────────────────────────

export interface DoubleElimResult {
  matches: Match[];
  winnersIds: string[];
  losersIds: string[];
  grandFinalId: string;
  byes: number;
}

export function buildDoubleElimination(athletes: Athlete[], base: BaseMatchInput): DoubleElimResult {
  // Winners bracket = single elimination.
  const winners = buildSingleElimination(athletes, base);
  const winnersMatches = winners.matches;
  const totalRounds = totalRoundsForAgeGroup(base.ageGroup);
  const size = nextPowerOfTwo(athletes.length);
  const wbRounds = roundNamesForSize(size);

  let matchNumber = base.startMatchNumber + winnersMatches.length;
  const now = base.startTime + winnersMatches.length * 20 * 60000;

  // Build a simplified losers bracket: one losers match per pair of winners-bracket
  // matches per round, chained into a single losers final.
  const losersMatches: Match[] = [];
  const wbByRound: string[][] = [];
  for (const name of wbRounds) {
    wbByRound.push(winnersMatches.filter(m => m.round === name).map(m => m.id));
  }

  // Number of losers "levels" mirrors winners rounds (excluding the final winner).
  let prevLosersIds: string[] = [];
  let lbIndex = 1;
  for (let r = 0; r < wbByRound.length; r++) {
    const wbRoundIds = wbByRound[r];
    // Losers dropping from this winners round.
    const droppers = wbRoundIds.length; // each WB match produces 1 loser
    const incoming = droppers + prevLosersIds.length;
    const matchCount = Math.floor(incoming / 2);
    const roundIds: string[] = [];
    for (let i = 0; i < matchCount; i++) {
      const id = uuidv4();
      roundIds.push(id);
      losersMatches.push({
        id, matchNumber: matchNumber++, bracketId: base.bracketId,
        category: base.category, ageGroup: base.ageGroup, weightCategory: base.weightCategory,
        round: `Losers Round ${lbIndex}`,
        redCornerId: '', blueCornerId: '', redCornerName: 'TBD', blueCornerName: 'TBD',
        matNumber: (i % 3) + 1,
        scheduledTime: new Date(now + losersMatches.length * 20 * 60000).toISOString(),
        status: 'scheduled', roundDurationSeconds: base.roundDuration, totalRounds,
        bracketType: 'losers',
      });
    }
    lbIndex++;

    // Wire winners-round losers into this losers round.
    wbRoundIds.forEach((wbId, idx) => {
      const wb = winnersMatches.find(m => m.id === wbId)!;
      const target = roundIds[Math.floor(idx / 2)] ?? roundIds[roundIds.length - 1];
      if (target) {
        wb.loserNextMatchId = target;
        wb.loserNextMatchSlot = idx % 2 === 0 ? 'RED' : 'BLUE';
      }
    });
    // Wire previous losers-round winners forward into this round too.
    prevLosersIds.forEach((lid, idx) => {
      const lm = losersMatches.find(m => m.id === lid)!;
      const target = roundIds[idx % Math.max(1, roundIds.length)];
      if (target && lm) {
        lm.nextMatchId = target;
        lm.nextMatchSlot = 'BLUE';
      }
    });
    prevLosersIds = roundIds;
  }

  // Grand Final.
  const grandFinalId = uuidv4();
  const wbFinal = winnersMatches.find(m => m.round === 'Final')!;
  const grandFinal: Match = {
    id: grandFinalId, matchNumber: matchNumber++, bracketId: base.bracketId,
    category: base.category, ageGroup: base.ageGroup, weightCategory: base.weightCategory,
    round: 'Grand Final',
    redCornerId: '', blueCornerId: '', redCornerName: 'WB Champion', blueCornerName: 'LB Champion',
    matNumber: 1,
    scheduledTime: new Date(now + (losersMatches.length + 1) * 20 * 60000).toISOString(),
    status: 'scheduled', roundDurationSeconds: base.roundDuration, totalRounds,
    bracketType: 'grand-final',
  };
  if (wbFinal) { wbFinal.nextMatchId = grandFinalId; wbFinal.nextMatchSlot = 'RED'; }
  const lastLoser = prevLosersIds[0] ? losersMatches.find(m => m.id === prevLosersIds[0]) : undefined;
  if (lastLoser) { lastLoser.nextMatchId = grandFinalId; lastLoser.nextMatchSlot = 'BLUE'; }

  const all = [...winnersMatches, ...losersMatches, grandFinal];
  return {
    matches: all,
    winnersIds: winnersMatches.map(m => m.id),
    losersIds: losersMatches.map(m => m.id),
    grandFinalId,
    byes: winners.byes,
  };
}

// ─── Round Robin ─────────────────────────────────────────────────────────────

export function buildRoundRobin(athletes: Athlete[], base: BaseMatchInput, poolId?: string): Match[] {
  // Circle method scheduling.
  const players: (Athlete | null)[] = [...athletes];
  if (players.length % 2 !== 0) players.push(null); // bye marker
  const n = players.length;
  const rounds = n - 1;
  const half = n / 2;
  const totalRounds = totalRoundsForAgeGroup(base.ageGroup);

  const matches: Match[] = [];
  let matchNumber = base.startMatchNumber;
  const arr = [...players];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const red = arr[i];
      const blue = arr[n - 1 - i];
      if (!red || !blue) continue; // skip bye pairings
      matches.push({
        id: uuidv4(), matchNumber: matchNumber++, bracketId: base.bracketId,
        category: base.category, ageGroup: base.ageGroup, weightCategory: base.weightCategory,
        round: poolId ? `Pool Round ${r + 1}` : `Round ${r + 1}`,
        redCornerId: red.id, blueCornerId: blue.id,
        redCornerName: red.fullName, blueCornerName: blue.fullName,
        matNumber: (matches.length % 3) + 1,
        scheduledTime: new Date(base.startTime + matches.length * 15 * 60000).toISOString(),
        status: 'scheduled', roundDurationSeconds: base.roundDuration, totalRounds,
        poolId,
      });
    }
    // Rotate (keep first fixed).
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as Athlete | null);
    arr.splice(0, arr.length, fixed, ...rest);
  }

  return matches;
}

// ─── Standings computation ───────────────────────────────────────────────────

export function computeStandings(
  athletes: Athlete[],
  matches: Match[],
  pointsForWin: number,
  pointsForDraw: number,
): Standing[] {
  const table = new Map<string, Standing>();
  for (const a of athletes) {
    table.set(a.id, {
      athleteId: a.id, athleteName: a.fullName, clubName: a.clubName,
      wins: 0, draws: 0, losses: 0, points: 0, matchesPlayed: 0,
    });
  }

  for (const m of matches) {
    if (m.status !== 'completed' || !m.result) continue;
    const red = table.get(m.redCornerId);
    const blue = table.get(m.blueCornerId);
    const isDraw = m.result.method === 'draw';
    if (isDraw) {
      if (red) { red.draws++; red.points += pointsForDraw; red.matchesPlayed++; }
      if (blue) { blue.draws++; blue.points += pointsForDraw; blue.matchesPlayed++; }
      continue;
    }
    const winnerId = m.result.winnerId;
    if (red) {
      red.matchesPlayed++;
      if (red.athleteId === winnerId) { red.wins++; red.points += pointsForWin; } else { red.losses++; }
    }
    if (blue) {
      blue.matchesPlayed++;
      if (blue.athleteId === winnerId) { blue.wins++; blue.points += pointsForWin; } else { blue.losses++; }
    }
  }

  const standings = Array.from(table.values());
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    // Tiebreaker: head-to-head.
    const h2h = matches.find(m =>
      m.status === 'completed' && m.result &&
      ((m.redCornerId === a.athleteId && m.blueCornerId === b.athleteId) ||
       (m.redCornerId === b.athleteId && m.blueCornerId === a.athleteId)));
    if (h2h && h2h.result && h2h.result.method !== 'draw') {
      if (h2h.result.winnerId === a.athleteId) return -1;
      if (h2h.result.winnerId === b.athleteId) return 1;
    }
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.athleteName.localeCompare(b.athleteName);
  });
  return standings;
}

// ─── Pool splitting ──────────────────────────────────────────────────────────

export function splitIntoPools(athletes: Athlete[], perPool: number): Athlete[][] {
  const shuffled = shuffle(athletes);
  const poolCount = Math.max(1, Math.round(shuffled.length / perPool));
  const pools: Athlete[][] = Array.from({ length: poolCount }, () => []);
  shuffled.forEach((a, i) => pools[i % poolCount].push(a));
  return pools.filter(p => p.length > 0);
}
