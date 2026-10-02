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

## Trusted admin backend

Privileged book and plan writes use callable Firebase Functions in
`functions/`. These functions initialize Firebase Admin SDK only on the server,
require an authenticated caller with the ID-token custom claim `admin: true`,
validate payloads, and write through the Admin SDK. Browser Firestore Rules
remain closed to every administrative write, even for an admin-claim client.

### Bootstrap the first administrator

There is deliberately no public function that grants administrator access.
From a project-owner workstation with Application Default Credentials for the
correct Firebase project, run:

```sh
cd functions
npm install
npm run admin:set-claim -- FIREBASE_AUTH_UID
```

For local owner scripts, use `gcloud auth application-default login` or point
`GOOGLE_APPLICATION_CREDENTIALS` at an owner-controlled service-account file
that stays outside this repository. The affected user must sign out/in or call
the client token-refresh utility before the `admin: true` claim appears.

### Local development and deployment

Install the Firebase CLI and configure the project outside source control.
Then use:

```sh
cd functions
npm install
npm run build
cd ..
firebase emulators:start
firebase deploy --only functions,firestore:rules
```

The emulator UI is configured on port 4000, Functions on 5001, and Firestore
on 8080. Deployment is intentionally manual; this repository contains no
service-account JSON or deploy credentials.
