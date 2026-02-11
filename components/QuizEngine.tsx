import React, { useState, useEffect } from 'react';
import { VocabularyWord, QuizQuestion, QuizResult } from '../types';
import { CheckCircle, XCircle, RefreshCcw, Trophy, Volume2, ArrowRight, AlertCircle } from 'lucide-react';

interface QuizEngineProps {
  words: VocabularyWord[];
  onComplete: (result: QuizResult) => void;
  onExit: () => void;
}

// Levenshtein Mesafesi hesaplayıcı
const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => 
    Array.from({ length: b.length + 1 }, (_, i) => i)
  );
  for (let i = 1; i <= a.length; i++) matrix[i][0] = i;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[a.length][b.length];
};

const QuizEngine: React.FC<QuizEngineProps> = ({ words, onComplete, onExit }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'partial' | null>(null);

  useEffect(() => {
    generateQuiz();
  }, []);

  const generateQuiz = () => {
    if (words.length === 0) return;

    const quizWords = [...words]
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(5, words.length));

    const generatedQuestions: QuizQuestion[] = quizWords.map(word => {
      const typeSeed = Math.random();
      let type: QuizQuestion['type'] = 'MC_EN_TR';

      if (typeSeed > 0.75) type = 'WRITE';
      else if (typeSeed > 0.50) type = 'LISTEN';
      else if (typeSeed > 0.25) type = 'MC_TR_EN';

      const distractors = words
        .filter(w => w.id !== word.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(w => type === 'MC_EN_TR' || type === 'LISTEN' ? w.translation : w.word);

      let options: string[] = [];
      let correctAnswer = '';
      let questionText = '';

      switch (type) {
        case 'MC_EN_TR':
          questionText = `What is the Turkish meaning of "${word.word}"?`;
          correctAnswer = word.translation;
          options = [...distractors, correctAnswer].sort(() => 0.5 - Math.random());
          break;
        case 'MC_TR_EN':
          questionText = `Which word means "${word.translation}"?`;
          correctAnswer = word.word;
          options = [...distractors, correctAnswer].sort(() => 0.5 - Math.random());
          break;
        case 'WRITE':
          questionText = `Type the English word for "${word.translation}"`;
          correctAnswer = word.word;
          break;
        case 'LISTEN':
          questionText = "Listen and select the correct meaning";
          correctAnswer = word.translation;
          options = [...distractors, correctAnswer].sort(() => 0.5 - Math.random());
          break;
      }

      return {
        id: Math.random().toString(),
        type,
        question: questionText,
        correctAnswer,
        options,
        wordReference: word
      };
    });

    setQuestions(generatedQuestions);
  };

  const playWordAudio = () => {
    const word = questions[currentIdx].wordReference.word;
    const ut = new SpeechSynthesisUtterance(word);
    ut.lang = 'en-US';
    window.speechSynthesis.speak(ut);
  };

  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
    const q = questions[currentIdx];
    const isCorrect = option === q.correctAnswer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    setIsAnswered(true);

    if (isCorrect) setScore(s => s + 1);
    else setWrongIds(prev => [...prev, q.wordReference.id]);
  };

  const handleTextSubmit = () => {
    if (isAnswered) return;
    
    const q = questions[currentIdx];
    
    // Normalizasyon: Boşlukları sil, küçük harfe çevir
    const userIn = textInput.toLowerCase().trim().replace(/\s+/g, ' ');
    const correct = q.correctAnswer.toLowerCase().trim().replace(/\s+/g, ' ');

    const dist = getLevenshteinDistance(userIn, correct);
    const len = correct.length;

    // 1. TAM DOĞRU (Büyük/Küçük Harf duyarsız)
    if (userIn === correct) {
      setFeedback('correct');
      setScore(s => s + 1);
    } 
    // 2. KISMİ DOĞRU TOLERANS MANTIĞI
    else if (
      // Kısa kelimelerde (<=3) tolerans yok veya max 0 (zaten üstte yakalanır)
      // Orta uzunluk (4-6 harf): Max 2 hata (Nigth vs Night dist=2, Close vs Closed dist=1)
      (len >= 4 && dist <= 2) ||
      // Uzun kelimelerde (7+): Max 3 hata (typo toleransı artar)
      (len >= 7 && dist <= 3) ||
      // Kök kontrolü (Close / Closed durumu)
      (correct.startsWith(userIn) && len - userIn.length <= 2) || 
      (userIn.startsWith(correct) && userIn.length - len <= 2)
    ) {
      setFeedback('partial');
      setScore(s => s + 0.5); // Yarım puan
    } 
    // 3. YANLIŞ
    else {
      setFeedback('wrong');
      setWrongIds(prev => [...prev, q.wordReference.id]);
    }

    setIsAnswered(true);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(c => c + 1);
      setSelectedOption(null);
      setTextInput('');
      setIsAnswered(false);
      setFeedback(null);
    } else {
      onComplete({
        score: Math.round(score), 
        total: questions.length,
        wrongWordIds: wrongIds
      });
    }
  };

  if (questions.length === 0) return null;

  const q = questions[currentIdx];

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="w-full h-3 bg-gray-100 dark:bg-gray-700">
        <div 
          className="h-full bg-brand-500 transition-all duration-500"
          style={{ width: `${((currentIdx) / questions.length) * 100}%` }}
        />
      </div>

      <div className="p-8 md:p-10">
        <div className="flex justify-between items-center mb-8">
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Soru {currentIdx + 1} / {questions.length}</span>
          <span className="text-[10px] font-black text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-3 py-1.5 rounded-full uppercase tracking-wider">
             {q.type.replace(/_/g, ' ')}
          </span>
        </div>

        <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-8 text-center leading-tight">
          {q.question}
        </h3>

        {q.type === 'LISTEN' && (
          <div className="flex justify-center mb-8">
            <button 
              onClick={playWordAudio}
              className="w-24 h-24 rounded-[2rem] bg-brand-100 hover:bg-brand-200 text-brand-600 flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-brand-500/10"
            >
              <Volume2 size={48} />
            </button>
          </div>
        )}

        <div className="space-y-4">
          {q.type === 'WRITE' ? (
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={isAnswered}
              onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
              placeholder="Cevabınızı yazın..."
              className={`w-full p-5 text-xl border-4 rounded-[1.5rem] outline-none transition-all font-bold text-center
                ${isAnswered 
                    ? feedback === 'correct' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                    : feedback === 'partial' ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-100 dark:border-gray-700 focus:border-brand-500 dark:focus:border-brand-500 bg-gray-50 dark:bg-gray-900 dark:text-white'}
              `}
              autoFocus
            />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {q.options?.map((opt, i) => {
                let btnClass = "p-5 text-left rounded-2xl border-2 transition-all font-black text-lg ";
                if (isAnswered) {
                  if (opt === q.correctAnswer) btnClass += "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 scale-[1.02] shadow-lg";
                  else if (selectedOption === opt) btnClass += "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300";
                  else btnClass += "border-gray-100 dark:border-gray-700 opacity-40";
                } else {
                  btnClass += selectedOption === opt 
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700" 
                    : "border-gray-100 dark:border-gray-700 hover:border-brand-300 dark:hover:border-gray-600 dark:text-white";
                }

                return (
                  <button key={i} onClick={() => handleOptionSelect(opt)} disabled={isAnswered} className={btnClass}>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="p-8 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
        {!isAnswered ? (
          q.type === 'WRITE' ? (
            <button
              onClick={handleTextSubmit}
              disabled={!textInput}
              className="w-full py-5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-[1.5rem] font-black text-xl shadow-xl shadow-brand-500/20 transition-all active:scale-95"
            >
              Kontrol Et
            </button>
          ) : (
             <p className="text-center text-gray-400 font-bold uppercase text-xs tracking-widest">Bir seçenek seçin</p>
          )
        ) : (
          <div className="animate-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-center mb-6">
                {feedback === 'correct' ? (
                  <div className="flex items-center text-green-600 dark:text-green-400 font-black text-xl">
                    <CheckCircle className="mr-3" size={28} />
                    Harika, doğru!
                  </div>
                ) : feedback === 'partial' ? (
                  <div className="flex flex-col text-orange-600 dark:text-orange-400">
                    <div className="flex items-center font-black text-xl">
                      <AlertCircle className="mr-3" size={28} />
                      Neredeyse doğru! (0.5 Puan)
                    </div>
                    <span className="text-sm font-bold mt-1 opacity-80">Doğrusu: <span className="underline">{q.correctAnswer}</span></span>
                  </div>
                ) : (
                  <div className="flex flex-col text-red-600 dark:text-red-400">
                    <div className="flex items-center font-black text-xl">
                      <XCircle className="mr-3" size={28} />
                      Maalesef yanlış
                    </div>
                    <span className="text-sm font-bold mt-1 opacity-80">Doğru cevap: <span className="underline">{q.correctAnswer}</span></span>
                  </div>
                )}
             </div>
             <button
              onClick={handleNext}
              className={`w-full py-5 rounded-[1.5rem] font-black text-xl text-white shadow-xl transition-all active:scale-95 ${
                feedback === 'correct' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' 
                : feedback === 'partial' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20'
              }`}
             >
               {currentIdx === questions.length - 1 ? 'Testi Bitir' : 'Sonraki Soru'}
               <ArrowRight className="inline-block ml-2" size={20} />
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizEngine;