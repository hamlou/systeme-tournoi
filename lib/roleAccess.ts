import type { RoleAccount, UserRole } from "@/types/tournament";

export type RoleSession = {
  authenticated: true;
  accountId: string;
  username: string;
  role: UserRole;
  displayName: string;
  refereeId?: string;
  athleteId?: string;
  clubId?: string;
  signedInAt: string;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Chief Admin",
  "central-referee": "Central Referee",
  "corner-referee": "Corner Referee",
  athlete: "Athlete",
  club: "Club",
  tv: "TV Display",
};

export const DEFAULT_ROLE_ACCOUNTS: RoleAccount[] = [
  {
    id: "seed-admin",
    username: process.env.NEXT_PUBLIC_ADMIN_USERNAME ?? "admin",
    password: process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "admin",
    role: "admin",
    displayName: "Chief Admin",
    approvalStatus: "Approved",
    createdAt: "2026-01-01T00:00:00.000Z",
    approvedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "seed-tv",
    username: "tv",
    password: "tv",
    role: "tv",
    displayName: "Arena TV",
    approvalStatus: "Approved",
    createdAt: "2026-01-01T00:00:00.000Z",
    approvedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "seed-athlete",
    username: "athlete1",
    password: "athlete1",
    role: "athlete",
    displayName: "Athlete Account",
    approvalStatus: "Approved",
    createdAt: "2026-01-01T00:00:00.000Z",
    approvedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "seed-club",
    username: "club1",
    password: "club1",
    role: "club",
    displayName: "Club Account",
    approvalStatus: "Approved",
    createdAt: "2026-01-01T00:00:00.000Z",
    approvedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "seed-central",
    username: "central1",
    password: "central1",
    role: "central-referee",
    displayName: "Central Referee Account",
    approvalStatus: "Approved",
    createdAt: "2026-01-01T00:00:00.000Z",
    approvedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "seed-corner",
    username: "corner1",
    password: "corner1",
    role: "corner-referee",
    displayName: "Corner Referee Account",
    approvalStatus: "Approved",
    createdAt: "2026-01-01T00:00:00.000Z",
    approvedAt: "2026-01-01T00:00:00.000Z",
  },
  ...Array.from({ length: 7 }, (_, index) => {
    const accountNumber = index + 1;
    return {
      id: `legacy-admin-${accountNumber}`,
      username: `admin${accountNumber}`,
      password: `admin${accountNumber}password`,
      role: "admin" as const,
      displayName: `Chief Admin ${accountNumber}`,
      approvalStatus: "Approved" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      approvedAt: "2026-01-01T00:00:00.000Z",
    };
  }),
];

const ROLE_DEFAULT_ROUTE: Record<UserRole, string> = {
  admin: "/dashboard",
  "central-referee": "/judging/judge",
  "corner-referee": "/judging/judge",
  athlete: "/athletes/register",
  club: "/clubs/register",
  tv: "/tv",
};

const ROLE_ROUTE_PREFIXES: Record<UserRole, string[]> = {
  admin: ["/"],
  "central-referee": ["/judging/judge", "/rounds"],
  "corner-referee": ["/judging/judge"],
  athlete: ["/athletes/register"],
  club: ["/clubs/register"],
  tv: ["/tv"],
};

export function getDefaultRouteForRole(role: UserRole) {
  return ROLE_DEFAULT_ROUTE[role];
}

export function canAccessRoute(role: UserRole, pathname: string | null | undefined) {
  if (!pathname) return true;
  if (pathname === "/") return true;
  if (role === "admin") return true;
  return ROLE_ROUTE_PREFIXES[role].some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export function accountRequiresApproval(role: UserRole) {
  return role === "central-referee" || role === "corner-referee";
}

export function getUniqueAccounts(accounts: RoleAccount[]) {
  const byUsername = new Map<string, RoleAccount>();
  [...DEFAULT_ROLE_ACCOUNTS, ...accounts].forEach(account => {
    byUsername.set(account.username.trim().toLowerCase(), account);
  });
  return Array.from(byUsername.values());
}

export function makeUsername(value: string, prefix: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24);
  return `${prefix}.${slug || "official"}`;
}
