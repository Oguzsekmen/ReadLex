import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
export type EntitlementStatus = 'FREE'|'TRIALING'|'ACTIVE'|'PAST_DUE'|'CANCELED'|'EXPIRED';
export type EntitlementData = { effectivePlan:'FREE'|'PREMIUM'; status:EntitlementStatus; entitlements:string[]; isPremium:boolean; isTrialing:boolean; trialEligible:boolean; trialEndsAt?:number; currentPeriodEnd?:number };
export const freeEntitlements: EntitlementData={effectivePlan:'FREE',status:'FREE',entitlements:['FREE'],isPremium:false,isTrialing:false,trialEligible:false};
export const normalizeEntitlements=(raw:unknown):EntitlementData=>{const v=raw as Partial<EntitlementData>; return v?.effectivePlan==='PREMIUM'&&Array.isArray(v.entitlements)&&v.entitlements.includes('PREMIUM')?{...freeEntitlements,...v,effectivePlan:'PREMIUM',isPremium:true,entitlements:v.entitlements,status:v.status||'ACTIVE'}:freeEntitlements};
const call=async(name:string)=>{if(!functions) throw new Error('UNAUTHENTICATED'); return normalizeEntitlements((await httpsCallable<Record<string,never>,unknown>(functions,name)({})).data)};
export const getMyEntitlements=()=>call('getMyEntitlements'); export const startTrial=()=>call('startTrial'); export const hasEntitlement=(data:EntitlementData|undefined, entitlement:string)=>Boolean(data?.entitlements?.includes(entitlement));
