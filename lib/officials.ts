import type { Referee } from "@/types/tournament";

export const TABLE_CHIEF_ASSIGNMENT_ID = "table-chief";
export const TABLE_CHIEF_LABEL = "Table Chief";

export function makeTableChiefOfficial(name = TABLE_CHIEF_LABEL): Referee {
  return {
    id: TABLE_CHIEF_ASSIGNMENT_ID,
    name,
    role: TABLE_CHIEF_LABEL,
    country: "Tunisia",
    grade: TABLE_CHIEF_LABEL,
    status: "Available",
    approvalStatus: "Approved",
  };
}

export function isTableChiefAssignment(id?: string | null) {
  return id === TABLE_CHIEF_ASSIGNMENT_ID;
}
