import React, { useState, useEffect } from 'react';
import { VocabularyWord, QuizQuestion, QuizResult } from '../types';
import { CheckCircle, XCircle, RefreshCcw, Trophy, Volume2, ArrowRight } from 'lucide-react';

interface QuizEngineProps {
  words: VocabularyWord[];
  onComplete: (result: QuizResult) => void;
  onExit: () => void;
}

const QuizEngine: React.FC<QuizEngineProps> = ({ words, onComplete, onExit }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  useEffect(() => {
    generateQuiz();
  }, []);

  const generateQuiz = () => {
    // Basic SRS Logic: Prioritize words with low strength or older review dates
    // For demo: Random shuffle 5 words
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

      // Generate Distractors (wrong options)
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

  // Immediate handler for options
  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;

    setSelectedOption(option);
    const q = questions[currentIdx];
    
    const isCorrect = option === q.correctAnswer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    setIsAnswered(true);

    if (isCorrect) {
      setScore(s => s + 1);
    } else {
      setWrongIds(prev => [...prev, q.wordReference.id]);
    }
  };

  // Manual submit for Text Input
  const handleTextSubmit = () => {
    if (isAnswered) return;
    
    const q = questions[currentIdx];
    const isCorrect = textInput.toLowerCase().trim() === q.correctAnswer.toLowerCase();

    setFeedback(isCorrect ? 'correct' : 'wrong');
    setIsAnswered(true);

    if (isCorrect) {
      setScore(s => s + 1);
    } else {
      setWrongIds(prev => [...prev, q.wordReference.id]);
    }
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(c => c + 1);
      setSelectedOption(null);
      setTextInput('');
      setIsAnswered(false);
      setFeedback(null);
    } else {
      // Finish
      onComplete({
        score,
        total: questions.length,
        wrongWordIds: wrongIds
      });
    }
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-gray-500 mb-4">No words in your vocabulary yet.</p>
        <button onClick={onExit} className="text-brand-600 font-medium hover:underline">Go read a book first!</button>
      </div>
    );
  }

  const q = questions[currentIdx];

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-100 dark:bg-gray-700">
        <div 
          className="h-full bg-brand-500 transition-all duration-300"
          style={{ width: `${((currentIdx) / questions.length) * 100}%` }}
        />
      </div>

      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <span className="text-sm font-medium text-gray-400">Question {currentIdx + 1} of {questions.length}</span>
          <span className="text-sm font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded">
             {q.type.replace(/_/g, ' ')}
          </span>
        </div>

        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          {q.question}
        </h3>

        {q.type === 'LISTEN' && (
          <div className="flex justify-center mb-6">
            <button 
              onClick={playWordAudio}
              className="w-20 h-20 rounded-full bg-brand-100 hover:bg-brand-200 text-brand-600 flex items-center justify-center transition-transform active:scale-95"
            >
              <Volume2 size={40} />
            </button>
          </div>
        )}

        {/* Answer Section */}
        <div className="space-y-3">
          {q.type === 'WRITE' ? (
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={isAnswered}
              onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
              placeholder="Type your answer..."
              className="w-full p-4 text-lg border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-brand-500 focus:ring-0 bg-transparent dark:text-white"
              autoFocus
            />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {q.options?.map((opt, i) => {
                let btnClass = "p-4 text-left rounded-xl border-2 transition-all font-medium ";
                if (isAnswered) {
                  if (opt === q.correctAnswer) btnClass += "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300";
                  else if (selectedOption === opt) btnClass += "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300";
                  else btnClass += "border-gray-100 dark:border-gray-700 opacity-50";
                } else {
                  btnClass += selectedOption === opt 
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700" 
                    : "border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-gray-600";
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleOptionSelect(opt)}
                    disabled={isAnswered}
                    className={btnClass}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer / Feedback */}
      <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 min-h-[100px] flex flex-col justify-center">
        {!isAnswered ? (
          q.type === 'WRITE' ? (
            <button
              onClick={handleTextSubmit}
              disabled={!textInput}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-500/30 transition-all"
            >
              Check Answer
            </button>
          ) : (
             <p className="text-center text-gray-400 text-sm">Select an option above</p>
          )
        ) : (
          <div className="animate-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-center mb-4">
                {feedback === 'correct' ? (
                  <div className="flex items-center text-green-600 dark:text-green-400 font-bold text-lg">
                    <CheckCircle className="mr-2" size={24} />
                    Correct!
                  </div>
                ) : (
                  <div className="flex flex-col text-red-600 dark:text-red-400">
                    <div className="flex items-center font-bold text-lg">
                      <XCircle className="mr-2" size={24} />
                      Incorrect
                    </div>
                    <span className="text-sm text-gray-500 mt-1">Correct answer: <span className="font-bold">{q.correctAnswer}</span></span>
                  </div>
                )}
             </div>
             <button
              onClick={handleNext}
              className={`w-full py-3 rounded-xl font-bold text-lg text-white shadow-lg transition-all ${
                feedback === 'correct' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/30'
              }`}
             >
               {currentIdx === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizEngine;