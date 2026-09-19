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
  subsidyloan: "Payments",
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

/** A quotation is locked (read-only) if: its own status is LOCKED, or it's a
 * non-final quote that was actually sent to the customer while another quote
 * has since been finalized (kept only as read-only history — a fresh/unsent
 * Draft stays editable regardless, since that's exactly how a new comparison
 * quote is built), or it's the final quotation and has been Approved —
 * fields freeze the moment it's accepted, not just once the job reaches
 * Subsidy/Loan or later. */
export function isEstimateLocked(input: {
  status: string;
  isCurrent: boolean;
  hasOtherFinalEstimate: boolean;
  connectionStage: ConnectionStageKey | null;
}): boolean {
  if (input.status === "LOCKED") return true;
  if (!input.isCurrent) {
    if (input.status === "DRAFT") return false;
    return input.hasOtherFinalEstimate;
  }
  if (input.status === "ACCEPTED") return true;
  if (input.connectionStage !== null) {
    return STAGE_ORDER.indexOf(input.connectionStage) >= STAGE_ORDER.indexOf("subsidyloan");
  }
  return false;
}
