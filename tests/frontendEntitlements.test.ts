import { describe, expect, it } from 'vitest';
import { freeEntitlements, hasEntitlement, normalizeEntitlements } from '../services/entitlements';
describe('frontend entitlements',()=>{
 it('normalizes free, trial and premium responses',()=>{expect(normalizeEntitlements({effectivePlan:'FREE'})).toEqual(freeEntitlements);expect(normalizeEntitlements({effectivePlan:'PREMIUM',status:'TRIALING',entitlements:['FREE','PREMIUM'],isTrialing:true})).toMatchObject({isPremium:true,isTrialing:true});expect(normalizeEntitlements({effectivePlan:'PREMIUM',status:'ACTIVE',entitlements:['PREMIUM']})).toMatchObject({isPremium:true,status:'ACTIVE'});});
 it('fails closed and checks entitlements safely',()=>{expect(normalizeEntitlements({effectivePlan:'PREMIUM'}).isPremium).toBe(false);expect(hasEntitlement({ ...freeEntitlements,entitlements:['FREE','PREMIUM']},'PREMIUM')).toBe(true);expect(hasEntitlement(undefined,'PREMIUM')).toBe(false);});
});
