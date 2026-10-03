import { requireProviderProductId } from '../catalog';
import { BillingProductKey } from '../types';

// Product IDs remain absent until App Store Connect configuration exists.
export const requireAppleProductId = (productKey: BillingProductKey): string => requireProviderProductId('APPLE', productKey);
