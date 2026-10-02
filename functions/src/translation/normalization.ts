/** Stable dictionary key: preserve surface morphology; normalize case/Unicode only. */
export const normalizeDictionaryWord = (value: string) => {
  let normalized = value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/’/g, "'");
  if (/^[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*(?:'s|')$/u.test(normalized)) normalized = normalized.replace(/(?:'s|')$/, '');
  return normalized;
};
