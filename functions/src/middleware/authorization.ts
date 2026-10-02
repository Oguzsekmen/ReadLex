import { HttpsError } from 'firebase-functions/v2/https';

type CallableAuth = { uid: string; token: Record<string, unknown> };
type CallableRequest = { auth?: CallableAuth | null };

export const requireAuthenticated = (request: CallableRequest): CallableAuth => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return request.auth;
};

export const requireAdmin = (request: CallableRequest): CallableAuth => {
  const auth = requireAuthenticated(request);
  if (auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Administrator access is required.');
  }
  return auth;
};
