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
- `users/{uid}/reviewEvents/{eventId}` contains immutable, server-created SRS review history.
- `subscriptions` and `payments` are server-authoritative and browser clients
  are read-only; entitlement state is resolved by trusted Functions, not profile
  fields or browser time. There is no payment provider yet. Any future provider
  verification and any premium-only backend operation must verify entitlement
  server-side; frontend entitlement data is only presentation and access UX.

## Billing foundation

Billing has a provider-neutral backend domain for future WEB, GOOGLE_PLAY, and
APPLE purchases. It defines logical monthly and yearly Premium products and
provider stubs that fail closed until the relevant provider account, product
mapping, and server-side verification are configured. A client purchase signal
can never grant Premium: only a verified backend purchase may later update a
subscription, after which the existing entitlement resolver remains authority.
No provider account, credentials, live product IDs, payment SDK, checkout, or
webhook is configured in this phase.

`verifyPurchase` is an authenticated backend-only callable boundary. A future
provider adapter must verify opaque client purchase proof before the server can
atomically record a normalized payment and update `subscriptions/{uid}`. Client
purchase success never grants entitlement. All current provider adapters and
product mappings remain intentionally unconfigured, so requests fail closed
until the relevant account credentials and live product IDs are added later.

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

## Translation preprocessing

Translation preparation is explicitly started by an administrator from the
Books panel; publishing a book only sets `languageProcessingStatus` to
`NOT_STARTED`. This prevents an accidental book update from spending provider
quota. The current supported pair is `en → tr`, stored on the book as
`sourceLanguage` and `targetLanguage` so additional pairs can be added without
changing document identity.

The Functions-only translation adapter uses Google Cloud Translation v3 and
Application Default Credentials. It segments English prose, stores every token
occurrence with exact offsets and sentence IDs, reuses language-pair-aware
global `dictionary/{deterministicId}` entries, translates only cache misses in
bounded batches, and writes book-specific data below:

- `books/{bookId}/languageChapters/{chapterId}` — chapter hash and token-chunk metadata
- `books/{bookId}/languageChapters/{chapterId}/tokenChunks/{chunkId}` — bounded token arrays
- `books/{bookId}/languageChapters/{chapterId}/sentences/{sentenceId}` — source and contextual translation

Sentence and chapter hashes prevent stale prepared data from being considered
current after a chapter edit. The edit marks the book `NOT_STARTED`; global
dictionary entries are intentionally retained. Completed dictionary batches and
sentence records act as retry checkpoints, so a retry avoids translating work
that was successfully persisted before a provider failure.

### Owner setup for translation

1. Enable the **Cloud Translation API** in the same Google Cloud project.
2. Grant the Cloud Functions runtime service account permission to call Cloud
   Translation (and retain its Firestore access).
3. Deploy Functions and Firestore Rules after enabling the API:

```sh
firebase deploy --only functions,firestore:rules
```

`TRANSLATION_PROVIDER=google-translation` is the default server setting. Never
add a Translation API key or credentials to `VITE_*`, source control, or the
browser. Automated tests use a fake provider only. An owner may manually smoke
test a tiny, non-copyrighted fixture through the Admin Books preparation action
after configuring Cloud Translation; no live provider call runs in CI.

Run preprocessing coverage with:

```sh
npm run test:translation
```

## Reader prepared-translation cache

BookReader now uses prepared language data only when a book is marked
`COMPLETED` and the chapter content hash matches. It renders the persisted
token occurrences directly, so repeated words retain their exact token index
and sentence ID. A normal prepared-book word tap never calls Google
Translation, Gemini, DeepL, or another runtime translation provider.

The reader loads one chapter metadata document plus that chapter's token
chunks, then prefetches only the chapter's unique dictionary IDs in Firestore
`in` query groups of 30. It loads a sentence document lazily on first use and
caches it; repeated taps reuse the in-memory token, dictionary, and sentence
records. Unprepared, stale, or incomplete data leaves the book readable and
shows a concise Turkish availability message rather than falling back to a
paid browser translation API.

Reader integration coverage:

```sh
npm run test:reader
```

## Reader Engine V2

The reader keeps rendering, language selection, scrolling, and progress
persistence as separate concerns. Prepared tokens remain the authoritative
rendering source for completed language chapters; legacy chapters retain the
safe local fallback and remain readable. Prepared token blocks preserve
punctuation and paragraph boundaries, and the reader initially renders a
bounded number of blocks before offering an incremental “load more” control
for long chapters.

Progress is stored in the existing `users/{uid}/progress/{bookId}` document.
It records the current chapter, chapter content hash, approximate token index,
scroll percentage, and last-read timestamp. Local scroll updates are batched:
only meaningful changes are saved after a five-second debounce, with a flush
on chapter navigation and when the page becomes hidden. This prevents a
continuous two-minute scroll from producing hundreds of Firestore writes.

Resume uses a saved token only when its chapter content hash still matches;
otherwise it falls back to the saved scroll position. The reader also exposes
stable token and sentence anchors through `scrollToToken` and
`scrollToSentence`, tracks user versus programmatic scrolling, and maintains
`activeTokenIndex` / `activeSentenceId` as foundations for the future Phase 4B
read-along feature. No audio is implemented by this layer.

Reader-engine coverage:

```sh
npm run test:reader-engine
```

Run the import coverage with:

```sh
npm run test:imports
```

## Spaced repetition core

Vocabulary reviews use a deterministic, simplified SM-2-inspired schedule.
`AGAIN` resets the learning repetition and schedules a ten-minute retry;
`HARD`, `GOOD`, and `EASY` progressively schedule 1+ day intervals while
keeping the ease factor between 1.3 and 2.8. The user-facing `strength` 1–5
is derived from repetitions, interval length, and error history—not used as
the scheduling algorithm itself.

The authenticated `submitVocabularyReview` callable Function owns scheduling:
it reads only `users/{uid}/vocabulary/{vocabularyId}`, transactionally updates
the SRS fields, and creates one immutable `users/{uid}/reviewEvents/{eventId}`
record. A caller-supplied `attemptId` makes retried submissions idempotent.
Browser clients retain normal vocabulary-content saves but cannot directly
modify SRS fields or create review events. Legacy vocabulary records missing
SRS fields receive safe initial defaults on their first review; no destructive
migration is required.

Run SRS coverage with:

```sh
npm run test:srs
npm run test:reviews
```

## Learning progress and streaks

Completed vocabulary reviews are the only Phase 5C activity that awards
learning XP or qualifies for a streak. The callable Function updates the SRS
record, immutable review event, immutable `users/{uid}/xpEvents/{eventId}`
record, profile XP/streak fields, and `users/{uid}/learningSummary/overview`
in one Firestore transaction. Retrying the same `attemptId` returns the
original event and does not award a second XP event or change summary counts.

The initial XP table is deterministic: `AGAIN` 0, `HARD` 5, `GOOD` 10, and
`EASY` 12. The daily goal is completed review items. Weak words have
`strength <= 2`; mastered words have `strength === 5`. New or legacy users
read safe zero defaults until their first server-verified review.

Streak days use a stable UTC `YYYY-MM-DD` key, calculated on the server from
the review timestamp. A second qualifying review on the same UTC day leaves
the streak unchanged; the next UTC day increments it; a gap resets the current
streak to one while retaining the longest streak. This avoids browser-local
midnight differences. Reader-progress XP is deliberately deferred rather than
trusting scroll events.

The dashboard reads only the compact summary document and the server-owned
profile total; browser rules allow owners to read `learningSummary` and
`xpEvents` but never write them, XP, streak fields, or aggregate counters. No
analytics SaaS, AI API, or external gamification provider is used.

```sh
npm run test:stats
npm run test:learning-summary
npm run test:reviews
```
