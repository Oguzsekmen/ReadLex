import { useCallback, useMemo, useState } from 'react';
import { QuizQuestion, ReviewGrade, VocabularyWord } from '../types';
import { submitReview } from '../services/learning/reviews';
import { attemptIdFor, buildReviewQuestions, evaluateAnswer, QuizAnswer } from '../services/learning/quiz';

export type ReviewSessionStatus = 'READY' | 'QUESTION' | 'ANSWERED' | 'SUBMITTING' | 'COMPLETE' | 'ERROR';
export const useReviewSession = (words: VocabularyWord[], options?: { size?: number; listening?: boolean; now?: number; submit?: typeof submitReview }) => {
  const [sessionId] = useState(() => `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const questions = useMemo(() => buildReviewQuestions(words, options?.now ?? Date.now(), options?.size ?? 10, options?.listening ?? false), [words, options?.listening, options?.now, options?.size]);
  const [index, setIndex] = useState(0); const [answer, setAnswer] = useState<QuizAnswer | null>(null); const [status, setStatus] = useState<ReviewSessionStatus>(questions.length ? 'QUESTION' : 'READY'); const [error, setError] = useState<string | null>(null); const [correct, setCorrect] = useState(0); const [wrong, setWrong] = useState(0);
  const currentQuestion: QuizQuestion | undefined = questions[index];
  const answerQuestion = useCallback((value: string) => { if (!currentQuestion || status !== 'QUESTION') return; const next = evaluateAnswer(currentQuestion, value); setAnswer(next); setCorrect(total => total + (next.correct ? 1 : 0)); setWrong(total => total + (next.correct ? 0 : 1)); setStatus('ANSWERED'); }, [currentQuestion, status]);
  const submitGrade = useCallback(async (grade: ReviewGrade) => { if (!currentQuestion || !answer) return; setStatus('SUBMITTING'); setError(null); try { await (options?.submit || submitReview)(currentQuestion.wordReference.id, grade, attemptIdFor(sessionId, currentQuestion)); if (index + 1 >= questions.length) setStatus('COMPLETE'); else { setIndex(value => value + 1); setAnswer(null); setStatus('QUESTION'); } } catch { setError('Tekrar kaydedilemedi. Lütfen yeniden deneyin.'); setStatus('ERROR'); } }, [answer, currentQuestion, index, options?.submit, questions.length, sessionId]);
  const retry = useCallback((grade: ReviewGrade) => void submitGrade(grade), [submitGrade]);
  return { sessionId, questions, currentQuestion, status, answer, error, correct, wrong, completed: correct + wrong, remaining: Math.max(0, questions.length - index - (status === 'COMPLETE' ? 0 : 1)), answerQuestion, submitGrade, retry };
};
