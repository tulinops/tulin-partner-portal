// Computes where a Connection sits in the Lead -> Warranty lifecycle from its
// real fields — no stored "current stage" column, so this can never drift
// out of sync with the data that actually drives it.

export const STAGE_ORDER = [
  "lead",
  "estimate",
  "sitevisit",
  "documents",
  "subsidyloan",
  "installation",
  "completed",
  "warranty",
] as const;

export type ConnectionStageKey = (typeof STAGE_ORDER)[number];

export const STAGE_LABELS: Record<ConnectionStageKey, string> = {
  lead: "Lead",
  estimate: "Estimate",
  sitevisit: "Site Visit",
  documents: "Documents",
  subsidyloan: "Subsidy / Loan",
  installation: "Installation",
  completed: "Completed",
  warranty: "Warranty",
};

export type StageInput = {
  siteVisitStatus: string;
  documentsVerified: boolean;
  subsidyStatus: string;
  currentLoanStatus: string | null;
  installationStatus: string;
  connectionStatus: string;
  warrantyRecordCount: number;
};

/** A Connection only exists once its Lead + Estimate are done, so those two
 * stages are always "behind" whatever this returns. */
export function computeConnectionStage(input: StageInput): ConnectionStageKey {
  if (input.warrantyRecordCount > 0) return "warranty";
  if (input.connectionStatus === "COMPLETED" || input.installationStatus === "COMPLETED") {
    return "completed";
  }
  const financingSettled = input.subsidyStatus === "DISBURSED" || input.currentLoanStatus === "COMPLETED";
  if (financingSettled) return "installation";
  if (input.siteVisitStatus === "COMPLETED" && input.documentsVerified) return "subsidyloan";
  if (input.siteVisitStatus === "COMPLETED") return "documents";
  return "sitevisit";
}

/** The estimate can be revised any time up through Site Visit/Documents, but
 * freezes once the job has genuinely entered Subsidy/Loan processing. */
export function isEstimateLocked(input: {
  financingMethod: string;
  subsidyStatus: string;
  loanApplicationsCount: number;
}): boolean {
  return (
    input.financingMethod !== "NOT_SELECTED" ||
    input.subsidyStatus !== "NOT_APPLIED" ||
    input.loanApplicationsCount > 0
  );
}
