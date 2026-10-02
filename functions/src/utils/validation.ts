import { HttpsError } from 'firebase-functions/v2/https';

export type BookPayload = {
  title: string; author: string; level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; coverUrl: string;
  chapters: Array<{ id: string; title: string; content: string }>;
  excerpt: string; requiredPlan: string[]; archived: boolean;
};
export type PlanPayload = { id: string; name: string; price: number; durationDays: number; features: string[] };

const fail = (message: string): never => { throw new HttpsError('invalid-argument', message); };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail('Expected an object.');
const text = (value: unknown, label: string, max: number, min = 1) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max ? value.trim() : fail(`Invalid ${label}.`);
export const resourceId = (value: unknown) => {
  const id = text(value, 'id', 128);
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : fail('Invalid id.');
};

export const validateBook = (value: unknown): BookPayload => {
  const input = record(value);
  const level = text(input.level, 'level', 2) as BookPayload['level'];
  if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) fail('Invalid level.');
  const coverUrl = text(input.coverUrl, 'coverUrl', 2048);
  try { const url = new URL(coverUrl); if (!['http:', 'https:'].includes(url.protocol)) fail('Invalid coverUrl.'); } catch { fail('Invalid coverUrl.'); }
  const rawChapters = Array.isArray(input.chapters) ? input.chapters : fail('Invalid chapters.');
  if (rawChapters.length < 1 || rawChapters.length > 200) fail('Invalid chapters.');
  const chapterIds = new Set<string>();
  const chapters = rawChapters.map((chapter: unknown) => {
    const item = record(chapter);
    const id = resourceId(item.id);
    if (chapterIds.has(id)) fail('Duplicate chapter id.');
    chapterIds.add(id);
    return { id, title: text(item.title, 'chapter title', 300), content: text(item.content, 'chapter content', 200000, 0) };
  });
  const rawRequiredPlan = Array.isArray(input.requiredPlan) ? input.requiredPlan : fail('Invalid requiredPlan.');
  if (rawRequiredPlan.length < 1 || rawRequiredPlan.length > 20) fail('Invalid requiredPlan.');
  const requiredPlan = rawRequiredPlan.map((plan: unknown) => resourceId(plan));
  if (new Set(requiredPlan).size !== requiredPlan.length) fail('Duplicate requiredPlan.');
  const archived = typeof input.archived === 'boolean' ? input.archived : fail('Invalid archived state.');
  return { title: text(input.title, 'title', 300), author: text(input.author, 'author', 300), level, coverUrl, chapters, excerpt: text(input.excerpt, 'excerpt', 10000, 0), requiredPlan, archived };
};

export const validatePlan = (value: unknown): PlanPayload => {
  const input = record(value);
  const price = typeof input.price === 'number' ? input.price : fail('Invalid price.');
  const durationDays = typeof input.durationDays === 'number' ? input.durationDays : fail('Invalid durationDays.');
  const rawFeatures = Array.isArray(input.features) ? input.features : fail('Invalid features.');
  if (!Number.isFinite(price) || price < 0 || price > 1000000) fail('Invalid price.');
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3660) fail('Invalid durationDays.');
  if (rawFeatures.length > 50) fail('Invalid features.');
  return { id: resourceId(input.id), name: text(input.name, 'name', 120), price, durationDays, features: rawFeatures.map((feature: unknown) => text(feature, 'feature', 500)) };
};
