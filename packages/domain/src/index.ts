import type { WorkspaceRole } from "@anycol/contracts";

export type CampaignStatus = "draft" | "active" | "completed" | "archived";
export type ContentStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

const campaignTransitions: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["active", "archived"],
  active: ["completed", "archived"],
  completed: ["archived", "active"],
  archived: [],
};

const contentTransitions: Record<ContentStatus, ContentStatus[]> = {
  draft: ["in_review", "cancelled"],
  in_review: ["draft", "approved", "cancelled"],
  approved: ["scheduled", "draft", "cancelled"],
  scheduled: ["publishing", "approved", "cancelled"],
  publishing: ["published", "failed"],
  published: [],
  failed: ["scheduled", "cancelled"],
  cancelled: ["draft"],
};

export function transitionCampaign(
  current: CampaignStatus,
  next: CampaignStatus,
): CampaignStatus {
  if (!campaignTransitions[current].includes(next))
    throw new DomainError(
      "INVALID_CAMPAIGN_TRANSITION",
      `Cannot transition campaign from ${current} to ${next}`,
    );
  return next;
}

export function transitionContent(
  current: ContentStatus,
  next: ContentStatus,
  role: WorkspaceRole,
): ContentStatus {
  if (
    next === "approved" &&
    !["owner", "admin", "strategist", "approver"].includes(role)
  )
    throw new DomainError("APPROVAL_FORBIDDEN", "Role cannot approve content");
  if (!contentTransitions[current].includes(next))
    throw new DomainError(
      "INVALID_CONTENT_TRANSITION",
      `Cannot transition content from ${current} to ${next}`,
    );
  return next;
}

export function buildUtmUrl(input: {
  destination: string;
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}): string {
  const url = new URL(input.destination);
  url.searchParams.set("utm_source", normalizeUtm(input.source));
  url.searchParams.set("utm_medium", normalizeUtm(input.medium));
  url.searchParams.set("utm_campaign", normalizeUtm(input.campaign));
  if (input.content)
    url.searchParams.set("utm_content", normalizeUtm(input.content));
  if (input.term) url.searchParams.set("utm_term", normalizeUtm(input.term));
  return url.toString();
}

function normalizeUtm(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9çğıöşü_-]/g, "");
}

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
