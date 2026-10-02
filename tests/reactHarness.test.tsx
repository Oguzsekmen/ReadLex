// @vitest-environment jsdom
import React, { useEffect, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('React lifecycle harness', () => {
  it('renders, updates state, runs effects, and cleans up on unmount', () => {
    const cleanup = vi.fn();
    const Probe = () => { const [count, setCount] = useState(0); useEffect(() => () => cleanup(), []); return <button onClick={() => setCount(value => value + 1)}>{count}</button>; };
    const view = render(<Probe />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('1');
    view.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
