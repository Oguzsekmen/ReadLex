import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

describe('native safe-area layout baseline', () => {
  it('defines reusable safe-area tokens and preserves viewport-fit coverage', () => {
    const css = source('styles.css');
    const html = source('index.html');
    expect(css).toContain('--safe-top: env(safe-area-inset-top, 0px)');
    expect(css).toContain('--safe-bottom: env(safe-area-inset-bottom, 0px)');
    expect(css).toContain('--safe-left: env(safe-area-inset-left, 0px)');
    expect(css).toContain('--safe-right: env(safe-area-inset-right, 0px)');
    expect(css).toContain('min-height: 100dvh');
    expect(html).toContain('viewport-fit=cover');
  });

  it('keeps shell/header, chapter navigation, and read-along controls clear of system edges', () => {
    expect(source('components/Layout.tsx')).toContain('var(--safe-top)');
    expect(source('components/Layout.tsx')).toContain('h-[100dvh]');
    expect(source('components/ChapterList.tsx')).toContain('var(--safe-top)');
    expect(source('components/ReadAlongPlayer.tsx')).toContain('var(--safe-bottom)');
    expect(source('components/ReadAlongPlayer.tsx')).toContain('var(--safe-left)');
    expect(source('components/ReadAlongPlayer.tsx')).toContain('var(--safe-right)');
  });
});

