import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-readlex-tests'; const host = '127.0.0.1'; const port = 9199;
let env;
const upload = (context, path, type = 'image/jpeg', size = 10) => context.storage().ref(path).put(new Blob([new Uint8Array(size)], { type }), { contentType: type });
before(async () => { env = await initializeTestEnvironment({ projectId, storage: { host, port, rules: await readFile('storage.rules', 'utf8') } }); });
beforeEach(async () => env.clearStorage()); after(async () => env.cleanup());

test('Storage denies anonymous and ordinary users, and permits only bounded admin source uploads', async () => {
  const path = 'book-imports/import-1/source/page-1.jpg';
  await assertFails(upload(env.unauthenticatedContext(), path));
  await assertFails(upload(env.authenticatedContext('reader'), path));
  await assertSucceeds(upload(env.authenticatedContext('admin', { admin: true }), path));
  await assertFails(upload(env.authenticatedContext('admin', { admin: true }), 'book-imports/import-1/ocr-output/out.json'));
  await assertFails(upload(env.authenticatedContext('admin', { admin: true }), path, 'text/plain'));
  await assertFails(env.authenticatedContext('admin', { admin: true }).storage().ref(path).getDownloadURL());
  assert.ok(true);
});
