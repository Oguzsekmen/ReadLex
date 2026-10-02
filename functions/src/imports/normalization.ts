export const normalizeImportText = (rawText: string) => {
  const normalizedLines = rawText
    .replace(/\r\n?/g, '\n')
    .replace(/([^\n\s])-\n([\p{L}])/gu, '$1$2')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(line => !/^\d{1,4}$/.test(line));

  return normalizedLines
    .join('\n')
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n')
    .trim();
};
