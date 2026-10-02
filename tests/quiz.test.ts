import { describe, expect, it } from 'vitest';
import { attemptIdFor, buildReviewQuestions, evaluateAnswer, normalizeAnswer } from '../services/learning/quiz';
import { VocabularyWord } from '../types';
const words = ['door', 'book', 'water', 'house', 'tree'].map((word, index) => ({ id: `w${index}`, word, translation: `tr-${word}`, definition: '', exampleSentence: '', type: 'noun', level: 'A1', sourceBookId: 'b', nextReviewDate: new Date(0), strength: index + 1 })) as VocabularyWord[];
describe('review quiz generation', () => {
  it('prioritizes due words and obeys bounded session sizes', () => expect(buildReviewQuestions(words, 1, 3).map(question => question.wordReference.id)).toEqual(['w0', 'w1', 'w2']));
  it('generates deterministic EN/TR, TR/EN, write and listening modes', () => expect(buildReviewQuestions(words, 1, 4, true).map(question => question.type)).toEqual(['MC_EN_TR', 'MC_TR_EN', 'WRITE', 'LISTEN']));
  it('keeps distractors unique and excludes the answer', () => { const question = buildReviewQuestions(words, 1, 1)[0]; const options = question.options || []; expect(new Set(options).size).toBe(options.length); expect(options).toContain(question.correctAnswer); });
  it('normalizes and evaluates answers with transparent suggested grades', () => { const question = buildReviewQuestions(words, 1, 1)[0]; expect(normalizeAnswer('  TR-DOOR ')).toBe('tr-door'); expect(evaluateAnswer(question, 'tr-door').suggestedGrade).toBe('GOOD'); expect(evaluateAnswer(question, 'wrong').suggestedGrade).toBe('AGAIN'); });
  it('creates a stable attempt id per session item', () => { const question = buildReviewQuestions(words, 1, 1)[0]; expect(attemptIdFor('session-x', question)).toBe(attemptIdFor('session-x', question)); });
});
