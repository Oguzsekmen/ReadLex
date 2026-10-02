import { Book, VocabularyWord } from '../types';
import { DictionaryEntry, PreparedReaderToken, PreparedSentence } from './readerLanguageData';

export const vocabularyFromPreparedToken = (book: Book, chapterId: string, token: PreparedReaderToken, dictionary: DictionaryEntry, sentence?: PreparedSentence): VocabularyWord => ({
  id: `${book.id}-${chapterId}-${token.index}`,
  word: token.text,
  normalizedWord: token.normalized || undefined,
  translation: dictionary.translation,
  definition: dictionary.definition || 'Hazırlanmış sözlük çevirisi',
  exampleSentence: sentence?.sourceText || '',
  type: dictionary.type || 'Kelime',
  level: book.level,
  sourceBookId: book.id,
  sourceChapterId: chapterId,
  nextReviewDate: new Date(),
  strength: 0
});
