import React from 'react';
import { LearningSummary as Summary } from '../services/learning/statsService';
import { dailyGoalProgress, isMasteredWord, isWeakWord } from '../services/learning/stats';
import { VocabularyEntry } from '../types';

export const LearningSummary: React.FC<{ summary: Summary; dailyGoal: number; vocabulary: VocabularyEntry[] }> = ({ summary, dailyGoal, vocabulary }) => {
  const mastered = vocabulary.filter(isMasteredWord).length;
  const weak = vocabulary.filter(isWeakWord).length;
  const percent = Math.round(dailyGoalProgress(summary.reviewedToday, dailyGoal) * 100);
  return <section aria-label="Öğrenme özeti" className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] border-2 border-gray-100 dark:border-gray-700 shadow-sm">
    <div className="flex items-baseline justify-between gap-4"><h2 className="text-2xl font-black dark:text-white">Öğrenme özeti</h2><span className="text-sm font-bold text-brand-600">{summary.totalXp} XP</span></div>
    <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><b>{summary.currentStreak}</b><span className="ml-1 text-gray-500">gün seri</span></div><div><b>{summary.reviewedToday}</b><span className="ml-1 text-gray-500">bugün tekrar</span></div><div><b>{mastered}</b><span className="ml-1 text-gray-500">öğrenildi</span></div><div><b>{weak}</b><span className="ml-1 text-gray-500">zayıf kelime</span></div></div>
    <div className="mt-5 flex items-center justify-between text-sm"><span className="font-bold text-gray-500">Günlük hedef</span><span>{summary.reviewedToday} / {dailyGoal}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"><div className="h-full rounded-full bg-green-500" style={{ width: `${percent}%` }} /></div>
  </section>;
};
