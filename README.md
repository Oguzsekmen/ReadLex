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
firebase deploy --only functions,firestore:rules,storage
```

The emulator UI is configured on port 4000, Functions on 5001, Firestore on
8080, and Storage on 9199. Deployment is intentionally manual; this repository contains no
service-account JSON or deploy credentials.

## Firestore data-model transition

New client writes use scalable documents while reads retain legacy fallback:

- `books/{bookId}` metadata with `books/{bookId}/chapters/{chapterId}` content.
- `users/{uid}/vocabulary/{entryId}` for individual vocabulary entries.
- `users/{uid}/progress/{bookId}` for one-book progress updates.
- `users/{uid}/reviewEvents/{eventId}` is reserved for a future Learning Engine.
- `subscriptions`, `payments`, and `dictionary` are typed and rule-protected;
  their server workflows are intentionally not implemented yet.

New vocabulary IDs are deterministic from language, normalized spelling, book,
and chapter source. This prevents a repeat save of the same source word from
creating another document, while allowing the word in a different book/chapter.

Existing embedded book chapters and legacy `vocabulary/{uid}` / `progress/{uid}`
documents are never deleted. During migration, readers merge new vocabulary and
progress with legacy values (new values win per logical key) until the owner
script records explicit completion under `users/{uid}/migrationState/data`.
Embedded chapters remain authoritative while `chapterMigrationState` is
`MIGRATING`, and switch to the chapter subcollection only at `MIGRATED`. Before
relying on a new write for an account with legacy data, copy that account using
the owner-run script:

```sh
cd functions
npm run migration:legacy -- books
npm run migration:legacy -- vocabulary FIREBASE_AUTH_UID
npm run migration:legacy -- progress FIREBASE_AUTH_UID
```

The migration is copy-only, idempotent, adds `migrationVersion`, and writes
completion metadata for book and user scopes. It uses owner ADC and never runs
from the app or deploy path. No composite indexes are currently required; the
empty `firestore.indexes.json` is versioned for future query changes.

## Emulator tests

The test scripts always use the disposable `demo-readlex-tests` project and
require a local Firestore Emulator; they never use the configured production
project or browser environment variables.

```sh
npm run test:compatibility
npm run test:rules
npm run test:migrations
npm run test:imports
npm run test:ocr
npm run test:storage
npm run test:emulator
```

`test:rules` covers direct browser-client Security Rules behavior. `test:migrations`
uses fake fixtures with the Firebase Admin SDK connected to the emulator and
executes the compiled owner migration script. Install a supported Java runtime
and ensure `java` is on `PATH` before running the emulator commands.

Legacy LocalStorage remains only as a temporary offline/error fallback. It is
not an authentication source and is not a two-way synchronization system.

## Content imports

Administrators create and review imports through callable Functions only. The
`bookImports/{importId}` collection is never directly readable or writable by
browser clients, including clients with an `admin: true` custom claim.

Pasted `TEXT` is fully supported: raw text is preserved, normalized with
the deterministic conservative utility, and converted into editable chapter
preview data before publication. `IMAGE` and `PDF` are modeled for later use
OCR source files use the narrow Storage prefix
`book-imports/{importId}/source/{fileId}-{safeFileName}`. Storage Rules permit
only an authenticated `admin: true` browser token to create bounded JPG/JPEG,
PNG, WEBP, or PDF source files there; browser reads, updates, deletes, OCR
output, and every other bucket path are denied. Callable Functions verify the
stored object metadata before accepting it into the server-authoritative job.

Phase 3B supports ordered page-image OCR and scanned PDF OCR through a
server-only provider adapter. The initial `google-vision` adapter uses runtime
Application Default Credentials and document text detection. Images are
processed one page at a time; PDFs use Cloud Vision's asynchronous GCS output
operation (set `OCR_OUTPUT_BUCKET` only when output must use a different
server-controlled bucket). No browser OCR credential, service-account JSON,
or `VITE_GOOGLE_*` secret is used. OCR results are retained in
`bookImports/{importId}/pages` and editable previews in
`bookImports/{importId}/draftChapters`, so large source/preview text does not
inflate the import job document. Publishing is transaction-backed and
idempotent, creating book metadata plus chapter subdocuments once and retaining
the import record as the source of provenance.

### Owner setup for OCR

1. Enable Firebase Storage and deploy `storage.rules`.
2. Enable the Google Cloud Vision API for the Firebase project.
3. Give the Cloud Functions runtime service account permission to read the
   import bucket and invoke Vision. For Vision PDF async output, it must also
   read/write the configured output bucket.
4. Deploy the functions, Firestore Rules, and Storage Rules:

```sh
firebase deploy --only functions,firestore:rules,storage
```

`OCR_PROVIDER=google-vision` is the default. Configure it only in the server
runtime/environment; never put provider credentials in the web app. OCR is a
bounded hybrid job (at most 20 images or one 25 MB PDF) and persists status and
page progress for polling. For very large documents, move the existing provider
service boundary to Cloud Tasks/Cloud Run before raising these limits.

Run the import coverage with:

```sh
npm run test:imports
```
