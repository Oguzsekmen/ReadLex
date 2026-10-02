import { QuizQuestion, ReviewGrade, VocabularyWord } from '../../types';
import { selectReviewCandidates } from './reviews';

export type QuizAnswer = { correct: boolean; normalizedAnswer: string; expectedAnswer: string; suggestedGrade: ReviewGrade };
export const normalizeAnswer = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
export const evaluateAnswer = (question: QuizQuestion, answer: string, hinted = false): QuizAnswer => {
  const correct = normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer);
  return { correct, normalizedAnswer: normalizeAnswer(answer), expectedAnswer: question.correctAnswer, suggestedGrade: correct ? (hinted ? 'HARD' : 'GOOD') : 'AGAIN' };
};
const unique = (values: string[]) => [...new Map(values.map(value => [normalizeAnswer(value), value])).values()];
const typeAt = (index: number, listening: boolean): QuizQuestion['type'] => {
  const types: QuizQuestion['type'][] = listening ? ['MC_EN_TR', 'MC_TR_EN', 'WRITE', 'LISTEN'] : ['MC_EN_TR', 'MC_TR_EN', 'WRITE'];
  return types[index % types.length];
};
export const buildReviewQuestions = (words: VocabularyWord[], now: number, size = 10, listening = false): QuizQuestion[] => {
  const candidates = selectReviewCandidates(words, now, Math.max(1, Math.min(size, 20)));
  return candidates.map((word, index) => {
    const type = typeAt(index, listening); const englishAnswer = type === 'MC_TR_EN' || type === 'WRITE';
    const correctAnswer = englishAnswer ? word.word : word.translation;
    const distractors = unique(words.filter(other => other.id !== word.id).map(other => englishAnswer ? other.word : other.translation).filter(value => normalizeAnswer(value) !== normalizeAnswer(correctAnswer))).slice(0, 3);
    const options = type === 'WRITE' ? undefined : unique([correctAnswer, ...distractors]);
    const question = type === 'MC_EN_TR' ? `“${word.word}” kelimesinin Türkçe anlamı nedir?` : type === 'MC_TR_EN' ? `“${word.translation}” anlamına gelen İngilizce kelime hangisidir?` : type === 'WRITE' ? `“${word.translation}” kelimesinin İngilizcesini yazın:` : 'Duyduğunuz kelimenin doğru anlamını seçin:';
    return { id: `session-${word.id}-${index}`, type, question, correctAnswer, options, wordReference: word };
  });
};
export const attemptIdFor = (sessionId: string, question: QuizQuestion) => `review-${sessionId}-${question.wordReference.id}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 128);
