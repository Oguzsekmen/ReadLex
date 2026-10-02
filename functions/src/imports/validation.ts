import { HttpsError } from 'firebase-functions/v2/https';
import { resourceId } from '../utils/validation';
import { ImportChapter, ImportSourceType } from './domain';

const fail = (message: string): never => { throw new HttpsError('invalid-argument', message); };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail('Expected an object.');
const optionalText = (value: unknown, label: string, max: number) => value === undefined || value === null || value === '' ? undefined : typeof value === 'string' && value.trim().length <= max ? value.trim() : fail(`Invalid ${label}.`);
const requiredText = (value: unknown, label: string, max: number) => {
  const result = optionalText(value, label, max);
  return result ? result : fail(`Invalid ${label}.`);
};

export type ImportMetadata = {
  title?: string;
  author?: string;
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  requiredPlan?: string[];
  coverUrl?: string;
  originalFileName?: string;
};

export const validateSourceType = (value: unknown): ImportSourceType =>
  value === 'TEXT' || value === 'IMAGE' || value === 'PDF' ? value : fail('Invalid sourceType.');

export const validateImportMetadata = (value: unknown): ImportMetadata => {
  const input = record(value || {});
  const level = optionalText(input.level, 'level', 2);
  if (level && !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) fail('Invalid level.');
  const rawPlans = input.requiredPlan;
  const requiredPlan = rawPlans === undefined ? undefined : Array.isArray(rawPlans) && rawPlans.length > 0 && rawPlans.length <= 20
    ? rawPlans.map(resourceId)
    : fail('Invalid requiredPlan.');
  if (requiredPlan && new Set(requiredPlan).size !== requiredPlan.length) fail('Duplicate requiredPlan.');
  const coverUrl = optionalText(input.coverUrl, 'coverUrl', 2048);
  if (coverUrl) {
    try {
      const url = new URL(coverUrl);
      if (!['http:', 'https:'].includes(url.protocol)) fail('Invalid coverUrl.');
    } catch { fail('Invalid coverUrl.'); }
  }
  return {
    title: optionalText(input.title, 'title', 300),
    author: optionalText(input.author, 'author', 300),
    level: level as ImportMetadata['level'],
    requiredPlan,
    coverUrl,
    originalFileName: optionalText(input.originalFileName, 'originalFileName', 300)
  };
};

export const validateRawText = (value: unknown) => requiredText(value, 'rawText', 2_000_000);

export const validateImportChapters = (value: unknown, allowEmpty = true): ImportChapter[] => {
  const chapters = Array.isArray(value) ? value : fail('Invalid detectedChapters.');
  if (chapters.length > 200 || (!allowEmpty && !chapters.length)) fail('Invalid detectedChapters.');
  const ids = new Set<string>();
  return chapters.map((chapter, order) => {
    const input = record(chapter);
    const tempId = resourceId(input.tempId);
    if (ids.has(tempId)) fail('Duplicate chapter id.');
    ids.add(tempId);
    const content = optionalText(input.content, 'chapter content', 200000) || '';
    return {
      tempId,
      title: requiredText(input.title, 'chapter title', 300),
      content,
      order,
      sourceStart: typeof input.sourceStart === 'number' && Number.isInteger(input.sourceStart) && input.sourceStart >= 0 ? input.sourceStart : undefined,
      sourceEnd: typeof input.sourceEnd === 'number' && Number.isInteger(input.sourceEnd) && input.sourceEnd >= 0 ? input.sourceEnd : undefined
    };
  });
};

export const validatePublishMetadata = (value: Record<string, unknown>) => {
  const metadata = validateImportMetadata(value);
  return {
    title: metadata.title || fail('Import title is required.'),
    author: metadata.author || fail('Import author is required.'),
    level: metadata.level || fail('Import level is required.'),
    requiredPlan: metadata.requiredPlan || fail('Import requiredPlan is required.'),
    coverUrl: metadata.coverUrl || fail('Import coverUrl is required.'),
    excerpt: typeof value.normalizedText === 'string' ? value.normalizedText.slice(0, 1000) : ''
  };
};
