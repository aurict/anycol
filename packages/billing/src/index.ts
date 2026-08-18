export type Plan = "starter" | "growth" | "agency" | "enterprise";
export type Entitlements = {
  brands: number;
  connectionsPerBrand: number;
  aiRunsPerMonth: number;
  whiteLabel: boolean;
  sso: boolean;
};
export const plans: Record<Plan, Entitlements> = {
  starter: {
    brands: 1,
    connectionsPerBrand: 4,
    aiRunsPerMonth: 50,
    whiteLabel: false,
    sso: false,
  },
  growth: {
    brands: 5,
    connectionsPerBrand: 10,
    aiRunsPerMonth: 500,
    whiteLabel: true,
    sso: false,
  },
  agency: {
    brands: 25,
    connectionsPerBrand: 20,
    aiRunsPerMonth: 5_000,
    whiteLabel: true,
    sso: false,
  },
  enterprise: {
    brands: Number.MAX_SAFE_INTEGER,
    connectionsPerBrand: Number.MAX_SAFE_INTEGER,
    aiRunsPerMonth: Number.MAX_SAFE_INTEGER,
    whiteLabel: true,
    sso: true,
  },
};
export function entitlement(
  plan: Plan,
  key: keyof Entitlements,
): Entitlements[keyof Entitlements] {
  return plans[plan][key];
}
export function withinUsage(
  plan: Plan,
  key: "brands" | "connectionsPerBrand" | "aiRunsPerMonth",
  current: number,
  requested = 1,
): boolean {
  return current + requested <= plans[plan][key];
}
