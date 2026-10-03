import { requireProviderProductId } from '../catalog';
import { BillingProductKey } from '../types';

// Logical-to-store mapping stays absent until Play Console product IDs exist.
export const requireGooglePlayProductId = (productKey: BillingProductKey): string => requireProviderProductId('GOOGLE_PLAY', productKey);
