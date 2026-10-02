import { adminAuth } from '../admin';

const uid = process.argv[2];
if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
  throw new Error('Usage: npm run admin:set-claim -- <Firebase Auth UID>');
}

const assignClaim = async () => {
  const user = await adminAuth.getUser(uid);
  await adminAuth.setCustomUserClaims(uid, { ...user.customClaims, admin: true });
  console.info(JSON.stringify({ operation: 'setAdminClaim', uid, result: 'success' }));
};

assignClaim().catch((error: unknown) => {
  console.error('Could not assign admin claim. Confirm owner ADC/project configuration.');
  process.exitCode = 1;
});
