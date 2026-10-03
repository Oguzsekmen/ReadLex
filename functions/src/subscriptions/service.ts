import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { EntitlementStatus, resolveEntitlements, SubscriptionRecord } from './entitlements';

export const DEFAULT_TRIAL_DAYS = 3;
const ref = (uid: string) => adminDb.collection('subscriptions').doc(uid);
const millis = (value: unknown) => value && typeof (value as { toMillis?: unknown }).toMillis === 'function' ? (value as { toMillis: () => number }).toMillis() : typeof value === 'number' ? value : undefined;
const data = (raw: Record<string, unknown> = {}): SubscriptionRecord => ({ ...raw, trialEndsAt: millis(raw.trialEndsAt), currentPeriodEnd: millis(raw.currentPeriodEnd) });
export const getEntitlements = async (uid: string, now = Date.now()) => resolveEntitlements(data((await ref(uid).get()).data()), now);
export const startTrial = async (uid: string, now = Date.now()) => adminDb.runTransaction(async tx => {
  const subscription = ref(uid); const snapshot = await tx.get(subscription); const current = data(snapshot.data()); const resolved = resolveEntitlements(current, now);
  if (resolved.isTrialing) return resolved;
  if (current.trialUsedAt) throw new HttpsError('failed-precondition', 'TRIAL_ALREADY_USED');
  const ends = now + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000;
  tx.set(subscription, { userId: uid, planId: 'PREMIUM', provider: 'NONE', status: 'TRIALING', trialStartedAt: now, trialEndsAt: ends, trialUsedAt: now, createdAt: snapshot.exists ? snapshot.data()?.createdAt : FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return resolveEntitlements({ status: 'TRIALING', trialEndsAt: ends, trialUsedAt: now }, now);
});
export const assignManualSubscription = async (targetUid: unknown, planId: unknown, status: unknown, periodEnd: unknown, now = Date.now()) => {
  if (typeof targetUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(targetUid) || typeof planId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(planId)) throw new HttpsError('invalid-argument', 'Invalid subscription assignment.');
  const allowed: EntitlementStatus[] = ['ACTIVE', 'CANCELED', 'PAST_DUE', 'EXPIRED']; if (!allowed.includes(status as EntitlementStatus) || typeof periodEnd !== 'number' || periodEnd <= now) throw new HttpsError('invalid-argument', 'Invalid manual subscription period.');
  await ref(targetUid).set({ userId: targetUid, planId, provider: 'MANUAL', status, currentPeriodStart: now, currentPeriodEnd: periodEnd, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return getEntitlements(targetUid, now);
};
