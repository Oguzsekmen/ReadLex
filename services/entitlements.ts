import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
export type EntitlementStatus = 'FREE'|'TRIALING'|'ACTIVE'|'PAST_DUE'|'CANCELED'|'EXPIRED';
export type EntitlementData = { effectivePlan:'FREE'|'PREMIUM'; status:EntitlementStatus; entitlements:string[]; isPremium:boolean; isTrialing:boolean; trialEligible:boolean; trialEndsAt?:number; currentPeriodEnd?:number };
export const freeEntitlements: EntitlementData={effectivePlan:'FREE',status:'FREE',entitlements:['FREE'],isPremium:false,isTrialing:false,trialEligible:false};
export const normalizeEntitlements=(raw:unknown):EntitlementData=>{const v=raw as Partial<EntitlementData>; return v?.effectivePlan==='PREMIUM'&&Array.isArray(v.entitlements)&&v.entitlements.includes('PREMIUM')?{...freeEntitlements,...v,effectivePlan:'PREMIUM',isPremium:true,entitlements:v.entitlements,status:v.status||'ACTIVE'}:freeEntitlements};
const call=async(name:string)=>{if(!functions) throw new Error('UNAUTHENTICATED'); return normalizeEntitlements((await httpsCallable<Record<string,never>,unknown>(functions,name)({})).data)};
export const getMyEntitlements=()=>call('getMyEntitlements'); export const startTrial=()=>call('startTrial'); export const hasEntitlement=(data:EntitlementData|undefined, entitlement:string)=>Boolean(data?.entitlements?.includes(entitlement));

// Legacy book documents may still contain plan IDs from the former browser-only
// subscription model. Keep that compatibility at this one boundary; UI code only
// consumes FREE or PREMIUM requirements.
export type BookEntitlementRequirement = 'FREE' | 'PREMIUM';
export const normalizeRequiredPlan = (plan: unknown): BookEntitlementRequirement =>
  typeof plan === 'string' && plan.toUpperCase() === 'FREE' ? 'FREE' : 'PREMIUM';
export const normalizeRequiredPlans = (plans: unknown): BookEntitlementRequirement[] =>
  Array.isArray(plans) ? plans.map(normalizeRequiredPlan) : ['PREMIUM'];
export const canAccessRequiredPlans = (plans: unknown, data: EntitlementData | undefined, loading = false) => {
  const requirements = normalizeRequiredPlans(plans);
  return requirements.includes('FREE') || (!loading && hasEntitlement(data, 'PREMIUM'));
};
