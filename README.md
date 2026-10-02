<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ReadLex

ReadLex is a React/Vite language-learning application using Firebase
Authentication for browser session authority.

## Local development

Prerequisite: Node.js 20 or later.

1. Copy `.env.example` to `.env.local`.
2. Fill only the Firebase Web configuration values. They are browser-visible
   identifiers, not server secrets; restrict the Firebase Web API key in Google
   Cloud and deploy the versioned Firestore Rules.
3. Install dependencies with `npm install`.
4. Run `npm run dev`, or verify a production bundle with `npm run build`.

## Firebase Authentication setup

In the Firebase Console, add the configured web app and then:

- Enable **Authentication → Sign-in method → Email/Password**.
- Enable the **Google** provider and complete its consent-screen setup.
- Add every development and production host under **Authentication → Settings
  → Authorized domains** (including `localhost` for local development).
- Deploy the versioned `firestore.rules` before using the app against a shared
  Firebase project.

The application waits for Firebase's `onAuthStateChanged` observer before
choosing the authenticated UI. It creates/loads `users/{Firebase Auth UID}`
after sign-in. Passwords are only handled by Firebase Auth and are never put
in Firestore, LocalStorage, the application user object, or logs.

Email/password registration sends a verification email. The UI exposes the
result as `user.emailVerified`, but verification is not yet enforced so local
development can continue. Production-sensitive capabilities should require it
in a future server-side authorization task.

Google login uses `signInWithPopup` on the web. This is intentionally isolated
behind `services/auth.ts`; a Capacitor/native provider must replace that
implementation for a mobile release.

## Roles and legacy users

The browser never grants roles. ReadLex derives its UI role from a Firebase ID
token `admin: true` custom claim; only a future Admin SDK/Functions task may
assign that claim. Firestore profile fields are not authorization inputs, and
AdminPanel mutations remain denied by the current rules.

Old Firestore profile documents that do not have matching Firebase Auth
accounts cannot be safely password-migrated. A controlled future migration may
create known Auth accounts with forced password reset, or have users claim
their accounts through a reset flow. No bulk migration runs in this project.

## Secrets

Never put Google Translate, DeepL, iyzico, service-account, webhook, private
API, or provider secret values in `VITE_*` variables or browser code. Future
translation and payment integrations belong in Firebase Functions/Cloud Run and
must retrieve secrets from Cloud Secret Manager or an equivalent server-side
secret store.

The included Firestore Rules allow authenticated reads of books/plans, own UID
profile/vocabulary/progress access, safe profile-field updates only, and deny
global dictionary-cache and all administrative writes.
