import { ImportChapter } from './domain';

const heading = /^(?:(?:chapter|part)\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)|(?:chapter|part)\s+[\p{L}]+)(?:\s*[:.\-—]\s*.*)?$/iu;

const titleFromHeading = (line: string) => line.replace(/\s+/g, ' ').trim();

export const detectImportChapters = (normalizedText: string): { chapters: ImportChapter[]; reviewRequired: boolean } => {
  const lines = normalizedText.split('\n');
  const headings = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => heading.test(line));

  if (!headings.length) {
    return {
      chapters: [{ tempId: 'chapter-1', title: 'Imported text', order: 0, content: normalizedText, sourceStart: 0, sourceEnd: normalizedText.length }],
      reviewRequired: true
    };
  }

  const offsets = lines.reduce<number[]>((result, line, index) => {
    result.push(index === 0 ? 0 : result[index - 1] + lines[index - 1].length + 1);
    return result;
  }, []);
  const chapters = headings.map(({ line, index }, order) => {
    const nextIndex = headings[order + 1]?.index ?? lines.length;
    const content = lines.slice(index + 1, nextIndex).join('\n').trim();
    return {
      tempId: `chapter-${order + 1}`,
      title: titleFromHeading(line),
      order,
      content,
      sourceStart: offsets[index],
      sourceEnd: nextIndex < lines.length ? offsets[nextIndex] - 1 : normalizedText.length
    };
  });
  return { chapters, reviewRequired: false };
};
