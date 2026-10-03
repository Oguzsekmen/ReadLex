import { describe, expect, it } from 'vitest';
import { normalizeStatus, resolveEntitlements } from '../functions/src/subscriptions/entitlements';
const now = 1_000;
describe('entitlement resolver', () => {
  it('fails safely to free for missing and malformed subscriptions', () => { expect(resolveEntitlements(undefined, now).effectivePlan).toBe('FREE'); expect(resolveEntitlements({ status: 'BAD' } as any, now).isPremium).toBe(false); });
  it('handles active and expired trials with permanent eligibility evidence', () => { expect(resolveEntitlements({ status: 'TRIALING', trialEndsAt: 1001, trialUsedAt: 1 }, now).isPremium).toBe(true); const expired = resolveEntitlements({ status: 'TRIALING', trialEndsAt: 999, trialUsedAt: 0 }, now); expect(expired.effectivePlan).toBe('FREE'); expect(expired.trialEligible).toBe(false); });
  it('handles active, canceled, expired and past-due periods conservatively', () => { expect(resolveEntitlements({ status: 'ACTIVE', currentPeriodEnd: 1001 }, now).isPremium).toBe(true); expect(resolveEntitlements({ status: 'CANCELED', currentPeriodEnd: 1001 }, now).isPremium).toBe(true); expect(resolveEntitlements({ status: 'ACTIVE', currentPeriodEnd: 999 }, now).isPremium).toBe(false); expect(resolveEntitlements({ status: 'EXPIRED' }, now).effectivePlan).toBe('FREE'); expect(resolveEntitlements({ status: 'PAST_DUE' }, now).isPremium).toBe(false); });
  it('normalizes legacy trial values only at the boundary', () => { expect(normalizeStatus('TRIAL')).toBe('TRIALING'); expect(normalizeStatus('TRAILER')).toBe('TRIALING'); });
});
