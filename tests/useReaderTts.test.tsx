// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReaderTts } from '../hooks/useReaderTts';
import { FakeReaderTtsAdapter } from '../services/tts/fakeReaderTts';
import { PreparedReaderToken } from '../services/readerLanguageData';
import { buildSpeechChunksFromToken } from '../services/tts/tokenSync';

const text = 'door opened the door. Next sentence.';
const tokens: PreparedReaderToken[] = [
  ['door', 0, 4, 's1'], ['opened', 5, 11, 's1'], ['the', 12, 15, 's1'], ['door', 16, 20, 's1'], ['Next', 22, 26, 's2'], ['sentence', 27, 35, 's2'],
].map(([word, start, end, sentenceId], index) => ({ index, text: word as string, normalized: word as string, start: start as number, end: end as number, sentenceId: sentenceId as string, isWord: true }));

type Exposed = ReturnType<typeof useReaderTts>;
const mount = (adapter = new FakeReaderTtsAdapter()) => { let state: Exposed | undefined; const Harness = () => { const value = useReaderTts(text, tokens, adapter); useEffect(() => { state = value; }); return null; }; const view = render(<Harness />); return { adapter, view, get state() { return state!; } }; };

describe('useReaderTts', () => {
  it('is idle and never autoplays on mount', () => { const harness = mount(); expect(harness.state.status).toBe('IDLE'); expect(harness.adapter.request).toBeUndefined(); expect(harness.state.activeTokenIndex).toBeUndefined(); });
  it('does not stop an idle adapter on mount or an unrelated rerender, but stops on unmount', () => {
    const adapter = new FakeReaderTtsAdapter(); const stop = vi.spyOn(adapter, 'stop');
    const Harness = ({ label }: { label: string }) => { useReaderTts(text, tokens, adapter); return <span>{label}</span>; };
    const view = render(<Harness label="first" />);
    expect(stop).not.toHaveBeenCalled();
    view.rerender(<Harness label="second" />);
    expect(stop).not.toHaveBeenCalled();
    view.unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
  it('maps boundaries to exact repeated canonical tokens and sentences', () => { const harness = mount(); act(() => harness.state.start()); expect(harness.adapter.request?.text).toBe(text); act(() => harness.adapter.boundary(0)); expect(harness.state.activeTokenIndex).toBe(0); expect(harness.state.activeSentenceId).toBe('s1'); act(() => harness.adapter.boundary(16)); expect(harness.state.activeTokenIndex).toBe(3); });
  it('starts suffixes from the requested canonical token and invalidates callbacks on unmount', () => { const harness = mount(); act(() => harness.state.startFromToken(1)); expect(harness.adapter.request?.text).toBe('opened the door. Next sentence.'); harness.view.unmount(); act(() => harness.adapter.boundary(0)); expect(harness.adapter.request?.text).toBe('opened the door. Next sentence.'); });
  it('pauses, resumes, stops, and navigates sentences without fake timing', () => { const harness = mount(); act(() => harness.state.start()); act(() => harness.adapter.boundary(16)); act(() => harness.state.pause()); expect(harness.state.paused).toBe(true); act(() => harness.state.resume()); expect(harness.state.speaking).toBe(true); act(() => harness.state.nextSentence()); expect(harness.adapter.request?.text).toBe('Next sentence.'); act(() => harness.state.stop()); expect(harness.state.status).toBe('IDLE'); });
  it('moves exactly three canonical spoken words and clamps at chapter boundaries', () => {
    const harness = mount();
    act(() => harness.state.start());
    act(() => harness.adapter.boundary(16));
    act(() => harness.state.moveByWords(-3));
    expect(harness.adapter.request?.text).toBe(text);
    act(() => harness.adapter.boundary(0));
    act(() => harness.state.moveByWords(3));
    expect(harness.adapter.request?.text).toBe('door. Next sentence.');
    act(() => harness.state.moveByWords(99));
    expect(harness.adapter.request?.text).toBe('sentence.');
  });
  it('narrates legacy chapter text with fallback tokens when translation preparation is unavailable', () => {
    const adapter = new FakeReaderTtsAdapter(); let state: Exposed | undefined;
    const Harness = () => { const value = useReaderTts('Legacy door text.', [], adapter); useEffect(() => { state = value; }); return null; };
    render(<Harness />);
    act(() => state!.start());
    expect(adapter.request?.text).toBe('Legacy door text.');
    act(() => adapter.boundary(7));
    expect(state!.activeTokenIndex).toBe(2);
    expect(state!.activeSentenceId).toBe('legacy-sentence-0');
  });
  it('speaks one bounded chunk at a time and maps later chunk boundaries to global tokens', () => {
    const longText = Array.from({ length: 500 }, () => 'door').join(' ');
    const longTokens: PreparedReaderToken[] = [...longText.matchAll(/door/g)].map((match, index) => ({ index, text: 'door', normalized: 'door', start: match.index!, end: match.index! + 4, sentenceId: `s${Math.floor(index / 8)}`, isWord: true }));
    const adapter = new FakeReaderTtsAdapter(); const speak = vi.spyOn(adapter, 'speak'); let state: Exposed | undefined;
    const Harness = () => { const value = useReaderTts(longText, longTokens, adapter); useEffect(() => { state = value; }); return null; };
    render(<Harness />);
    act(() => state!.start());
    const firstCallbacks = adapter.callbacks;
    expect(speak).toHaveBeenCalledOnce();
    expect(adapter.request!.text.length).toBeLessThanOrEqual(1000);
    act(() => adapter.end());
    expect(speak).toHaveBeenCalledTimes(2);
    expect(adapter.request!.text.length).toBeLessThanOrEqual(1000);
    const secondStart = buildSpeechChunksFromToken(longText, longTokens, 0)[1].globalStartChar;
    act(() => adapter.boundary(0));
    expect(state!.activeTokenIndex).toBe(longTokens.find(token => token.start === secondStart)?.index);
    act(() => state!.stop());
    act(() => firstCallbacks?.onEnd?.());
    expect(speak).toHaveBeenCalledTimes(2);
  });
});
