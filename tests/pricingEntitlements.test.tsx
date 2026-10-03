// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Pricing from '../components/Pricing';
import { freeEntitlements } from '../services/entitlements';

const user: any = { id: 'u', name: 'Ada', languagePreference: 'TR', plan: 'FREE', subscriptionStatus: 'ACTIVE', streak: 0, xp: 0, dailyGoal: 25 };
const renderPricing = (props: Partial<React.ComponentProps<typeof Pricing>> = {}) => render(<Pricing user={user} entitlement={{ ...freeEntitlements, trialEligible: true }} loading={false} onStartTrial={vi.fn().mockResolvedValue(freeEntitlements)} onRetry={vi.fn().mockResolvedValue(undefined)} {...props} />);

describe('Pricing entitlement UI', () => {
  afterEach(cleanup);

  it('offers a server-backed trial and contains no card or checkout form', () => {
    renderPricing();
    expect(screen.getByRole('button', { name: 'Ücretsiz denemeyi başlat' })).toBeTruthy();
    expect(screen.queryByLabelText(/kart|card|cvc/i)).toBeNull();
    expect(screen.queryByText(/Ödeme Başarılı|Payment Successful/i)).toBeNull();
  });

  it('waits for startTrial and shows the entitlement supplied by the parent after success', async () => {
    const startTrial = vi.fn().mockResolvedValue({ ...freeEntitlements, effectivePlan: 'PREMIUM', status: 'TRIALING', entitlements: ['FREE', 'PREMIUM'], isPremium: true, isTrialing: true, trialEndsAt: 1_900_000_000_000 });
    const view = renderPricing({ onStartTrial: startTrial });
    fireEvent.click(screen.getByRole('button', { name: 'Ücretsiz denemeyi başlat' }));
    await waitFor(() => expect(startTrial).toHaveBeenCalledOnce());
    view.rerender(<Pricing user={user} entitlement={await startTrial.mock.results[0].value} loading={false} onStartTrial={startTrial} onRetry={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByText('Premium üyeliğiniz aktif.')).toBeTruthy();
  });

  it('does not grant premium when the backend rejects an already-used trial', async () => {
    renderPricing({ onStartTrial: vi.fn().mockRejectedValue(new Error('TRIAL_ALREADY_USED')) });
    fireEvent.click(screen.getByRole('button', { name: 'Ücretsiz denemeyi başlat' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Ücretsiz deneme daha önce kullanıldı.');
    expect(screen.getByText('Ücretsiz planı kullanıyorsunuz.')).toBeTruthy();
  });
});
