import { Book, User, VocabularyWord } from '../types';

export const MOCK_USER: User = {
  id: 'u1',
  email: 'demo@lexiflow.app',
  name: 'Demo User',
  languagePreference: 'TR',
  role: 'USER',
  streak: 12,
  xp: 450,
  subscriptionStatus: 'ACTIVE',
  plan: 'MONTHLY',
  trialEndsAt: Date.now() + 30 * 24 * 60 * 60 * 1000
};

export const MOCK_BOOKS: Book[] = [
  {
    id: 'b1',
    title: 'The Lost Key',
    author: 'Elena Richards',
    level: 'A1',
    coverUrl: 'https://picsum.photos/300/450?random=1',
    totalWords: 450,
    excerpt: 'Sarah looked for her key everywhere. It was not in her pocket.',
    content: `Sarah looked for her key everywhere. It was not in her pocket. It was not on the table. "Where is it?" she asked. The sun was hot. She wanted to go inside her house.

Suddenly, she saw something shiny in the grass. It was yellow. She walked to the grass. "Is this my key?" she thought. She picked it up. Yes! It was her key. She was very happy.`
  },
  {
    id: 'b2',
    title: 'Digital Horizons',
    author: 'Marcus Chen',
    level: 'B2',
    coverUrl: 'https://picsum.photos/300/450?random=2',
    totalWords: 1200,
    excerpt: 'The rapid evolution of artificial intelligence has sparked both excitement and concern.',
    content: `The rapid evolution of artificial intelligence has sparked both excitement and concern across the globe. Experts argue that while automation can increase efficiency, it also poses significant ethical dilemmas regarding privacy and employment.

However, historical trends suggest that technology often creates more jobs than it destroys. The transition period is usually the most challenging. Societies must adapt their educational systems to prepare the workforce for a future where collaboration with machines is the norm.`
  },
  {
    id: 'b3',
    title: 'The Quantum Paradox',
    author: 'Dr. A. Vance',
    level: 'C1',
    coverUrl: 'https://picsum.photos/300/450?random=3',
    totalWords: 2500,
    excerpt: 'Quantum entanglement defies classical intuition, suggesting a universe far more interconnected than previously conceived.',
    content: `Quantum entanglement defies classical intuition, suggesting a universe far more interconnected than previously conceived. When two particles become entangled, the state of one instantly influences the other, regardless of the vast distance separating them. Einstein famously derided this as "spooky action at a distance."

Contemporary physicists, however, are harnessing this phenomenon for cryptography and computing. The implications are profound: if information can be teleported, the fundamental constraints of space-time might be negotiable.`
  }
];

export const MOCK_VOCAB: VocabularyWord[] = [
  {
    id: 'v1',
    word: 'evolution',
    translation: 'evrim',
    definition: 'The gradual development of something, especially from a simple to a more complex form.',
    exampleSentence: 'The evolution of computer graphics has been remarkable.',
    type: 'noun',
    level: 'B2',
    sourceBookId: 'b2',
    nextReviewDate: new Date(),
    strength: 1
  },
  {
    id: 'v2',
    word: 'sparked',
    translation: 'kıvılcımlamak / başlatmak',
    definition: 'To provide the stimulus for a sudden outbreak of something.',
    exampleSentence: 'The trial sparked a furious debate about the justice system.',
    type: 'verb',
    level: 'B2',
    sourceBookId: 'b2',
    nextReviewDate: new Date(),
    strength: 2
  },
  {
    id: 'v3',
    word: 'dilemmas',
    translation: 'ikilemler',
    definition: 'A situation in which a difficult choice has to be made between two or more alternatives.',
    exampleSentence: 'He is facing a serious moral dilemma.',
    type: 'noun',
    level: 'B2',
    sourceBookId: 'b2',
    nextReviewDate: new Date(),
    strength: 3
  },
  {
    id: 'v4',
    word: 'shiny',
    translation: 'parlak',
    definition: 'Reflecting light, typically because very clean or polished.',
    exampleSentence: 'She bought a shiny new car.',
    type: 'adjective',
    level: 'A1',
    sourceBookId: 'b1',
    nextReviewDate: new Date(),
    strength: 4
  }
];