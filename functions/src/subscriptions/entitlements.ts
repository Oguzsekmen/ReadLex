export type EntitlementStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
export type SubscriptionProvider = 'NONE' | 'MANUAL' | 'IYZICO' | 'GOOGLE_PLAY' | 'APPLE';
export type Entitlement = 'FREE' | 'PREMIUM';
export type SubscriptionRecord = { userId?: string; status?: EntitlementStatus | 'TRIAL' | 'TRAILER'; planId?: string; provider?: SubscriptionProvider; trialEndsAt?: number; currentPeriodEnd?: number; trialUsedAt?: number };
export type EntitlementResult = { effectivePlan: 'FREE' | 'PREMIUM'; status: EntitlementStatus | 'FREE'; entitlements: Entitlement[]; isPremium: boolean; isTrialing: boolean; currentPeriodEnd?: number; trialEndsAt?: number; trialEligible: boolean };
export const normalizeStatus = (value: unknown): EntitlementStatus | undefined => value === 'TRIAL' || value === 'TRAILER' ? 'TRIALING' : value === 'TRIALING' || value === 'ACTIVE' || value === 'PAST_DUE' || value === 'CANCELED' || value === 'EXPIRED' ? value : undefined;

// Pure, deterministic and provider-independent. Functions supply server time.
export const resolveEntitlements = (subscription: SubscriptionRecord | undefined, now: number): EntitlementResult => {
  const status = normalizeStatus(subscription?.status); const hasUsedTrial = typeof subscription?.trialUsedAt === 'number'; const free = (state: EntitlementStatus | 'FREE' = 'FREE'): EntitlementResult => ({ effectivePlan: 'FREE', status: state, entitlements: ['FREE'], isPremium: false, isTrialing: false, trialEligible: !hasUsedTrial });
  if (!status) return free();
  if (status === 'TRIALING') return subscription?.trialEndsAt && now < subscription.trialEndsAt ? { effectivePlan: 'PREMIUM', status, entitlements: ['FREE', 'PREMIUM'], isPremium: true, isTrialing: true, trialEndsAt: subscription.trialEndsAt, trialEligible: false } : free('EXPIRED');
  const valid = Boolean(subscription?.currentPeriodEnd && now < subscription.currentPeriodEnd);
  if ((status === 'ACTIVE' || status === 'CANCELED') && valid) return { effectivePlan: 'PREMIUM', status, entitlements: ['FREE', 'PREMIUM'], isPremium: true, isTrialing: false, currentPeriodEnd: subscription!.currentPeriodEnd, trialEligible: !hasUsedTrial };
  return free(status === 'PAST_DUE' ? 'PAST_DUE' : 'EXPIRED');
};
