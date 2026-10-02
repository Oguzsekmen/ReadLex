// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useReaderTts } from '../hooks/useReaderTts';
import { FakeReaderTtsAdapter } from '../services/tts/fakeReaderTts';
import { PreparedReaderToken } from '../services/readerLanguageData';

const text = 'door opened the door. Next sentence.';
const tokens: PreparedReaderToken[] = [
  ['door', 0, 4, 's1'], ['opened', 5, 11, 's1'], ['the', 12, 15, 's1'], ['door', 16, 20, 's1'], ['Next', 22, 26, 's2'], ['sentence', 27, 35, 's2'],
].map(([word, start, end, sentenceId], index) => ({ index, text: word as string, normalized: word as string, start: start as number, end: end as number, sentenceId: sentenceId as string, isWord: true }));

type Exposed = ReturnType<typeof useReaderTts>;
const mount = (adapter = new FakeReaderTtsAdapter()) => { let state: Exposed | undefined; const Harness = () => { const value = useReaderTts(text, tokens, adapter); useEffect(() => { state = value; }); return null; }; const view = render(<Harness />); return { adapter, view, get state() { return state!; } }; };

describe('useReaderTts', () => {
  it('is idle and never autoplays on mount', () => { const harness = mount(); expect(harness.state.status).toBe('IDLE'); expect(harness.adapter.request).toBeUndefined(); expect(harness.state.activeTokenIndex).toBeUndefined(); });
  it('maps boundaries to exact repeated canonical tokens and sentences', () => { const harness = mount(); act(() => harness.state.start()); expect(harness.adapter.request?.text).toBe(text); act(() => harness.adapter.boundary(0)); expect(harness.state.activeTokenIndex).toBe(0); expect(harness.state.activeSentenceId).toBe('s1'); act(() => harness.adapter.boundary(16)); expect(harness.state.activeTokenIndex).toBe(3); });
  it('starts suffixes from the requested canonical token and invalidates callbacks on unmount', () => { const harness = mount(); act(() => harness.state.startFromToken(1)); expect(harness.adapter.request?.text).toBe('opened the door. Next sentence.'); harness.view.unmount(); act(() => harness.adapter.boundary(0)); expect(harness.adapter.request?.text).toBe('opened the door. Next sentence.'); });
  it('pauses, resumes, stops, and navigates sentences without fake timing', () => { const harness = mount(); act(() => harness.state.start()); act(() => harness.adapter.boundary(16)); act(() => harness.state.pause()); expect(harness.state.paused).toBe(true); act(() => harness.state.resume()); expect(harness.state.speaking).toBe(true); act(() => harness.state.nextSentence()); expect(harness.adapter.request?.text).toBe('Next sentence.'); act(() => harness.state.stop()); expect(harness.state.status).toBe('IDLE'); });
});
