import React, { useState } from 'react';
import { Check, Crown, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { User } from '../types';
import { EntitlementData } from '../services/entitlements';

interface PricingProps {
  user: User;
  entitlement: EntitlementData;
  loading: boolean;
  error?: string;
  onStartTrial: () => Promise<EntitlementData>;
  onRetry: () => Promise<void>;
}

const formatServerDate = (value: number | undefined, language: User['languagePreference']) =>
  value ? new Date(value).toLocaleDateString(language === 'TR' ? 'tr-TR' : 'en-US') : undefined;

const Pricing: React.FC<PricingProps> = ({ user, entitlement, loading, error, onStartTrial, onRetry }) => {
  const [startingTrial, setStartingTrial] = useState(false);
  const [trialMessage, setTrialMessage] = useState<string>();
  const lang = user.languagePreference;
  const startTrial = async () => {
    if (startingTrial || loading) return;
    setStartingTrial(true);
    setTrialMessage(undefined);
    try {
      await onStartTrial();
    } catch (cause) {
      const code = (cause as Error).message;
      setTrialMessage(code === 'TRIAL_ALREADY_USED'
        ? (lang === 'TR' ? 'Ücretsiz deneme daha önce kullanıldı.' : 'The free trial has already been used.')
        : (lang === 'TR' ? 'Deneme başlatılamadı. Lütfen tekrar deneyin.' : 'The trial could not be started. Please try again.'));
    } finally { setStartingTrial(false); }
  };

  if (loading) return <div className="p-10 text-center dark:text-white flex items-center justify-center"><Loader2 className="animate-spin mr-2" />{lang === 'TR' ? 'Üyelik bilgisi yükleniyor...' : 'Loading membership...'}</div>;

  const trialEnd = formatServerDate(entitlement.trialEndsAt, lang);
  const periodEnd = formatServerDate(entitlement.currentPeriodEnd, lang);
  const premium = entitlement.isPremium;

  return <div className="max-w-3xl mx-auto pb-20 animate-in slide-in-from-bottom-4 duration-500">
    <header className="text-center mb-10"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-100 text-brand-600 dark:bg-brand-900/40"><Crown size={32} /></div><h1 className="text-4xl font-black text-gray-900 dark:text-white">{lang === 'TR' ? 'ReadLex Üyeliği' : 'ReadLex Membership'}</h1><p className="mt-3 text-lg text-gray-600 dark:text-gray-300">{premium ? (lang === 'TR' ? 'Premium üyeliğiniz aktif.' : 'Your Premium membership is active.') : (lang === 'TR' ? 'Ücretsiz planı kullanıyorsunuz.' : 'You are using the Free plan.')}</p></header>
    {error && <div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><p className="font-bold">{lang === 'TR' ? 'Üyelik bilgisi alınamadı. Tekrar deneyin.' : 'Membership information could not be loaded. Please retry.'}</p><button onClick={() => void onRetry()} className="mt-3 inline-flex items-center gap-2 text-sm font-bold underline"><RefreshCw size={15} />{lang === 'TR' ? 'Tekrar dene' : 'Retry'}</button></div>}
    <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wider text-gray-500">{lang === 'TR' ? 'Mevcut durum' : 'Current status'}</p><h2 className="mt-1 text-2xl font-black dark:text-white">{entitlement.isTrialing ? (lang === 'TR' ? 'Premium deneme aktif' : 'Premium trial active') : premium ? 'Premium' : 'Free'}</h2></div><Sparkles className={premium ? 'text-yellow-500' : 'text-gray-400'} size={30} /></div>
      {entitlement.isTrialing && trialEnd && <p className="mt-5 rounded-xl bg-brand-50 p-4 font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">{lang === 'TR' ? `Denemeniz ${trialEnd} tarihine kadar aktif.` : `Your trial is active until ${trialEnd}.`}</p>}
      {!entitlement.isTrialing && premium && periodEnd && <p className="mt-5 rounded-xl bg-brand-50 p-4 font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">{lang === 'TR' ? `Üyeliğiniz ${periodEnd} tarihine kadar aktif.` : `Your membership is active until ${periodEnd}.`}</p>}
      {!premium && entitlement.trialEligible && <button onClick={() => void startTrial()} disabled={startingTrial} className="mt-6 w-full rounded-2xl bg-brand-600 py-4 font-black text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{startingTrial ? <><Loader2 className="mr-2 inline animate-spin" size={18} />{lang === 'TR' ? 'Deneme başlatılıyor...' : 'Starting trial...'}</> : (lang === 'TR' ? 'Ücretsiz denemeyi başlat' : 'Start free trial')}</button>}
      {!premium && !entitlement.trialEligible && <p className="mt-6 text-center font-medium text-gray-500">{lang === 'TR' ? 'Premium satın alma yakında.' : 'Premium purchase is coming soon.'}</p>}
      {trialMessage && <p role="alert" className="mt-4 text-center font-bold text-red-600">{trialMessage}</p>}
    </section>
    <section className="mt-8 rounded-3xl border border-gray-100 bg-white p-8 dark:border-gray-700 dark:bg-gray-800"><h2 className="text-xl font-black dark:text-white">{lang === 'TR' ? 'Premium ile' : 'With Premium'}</h2><ul className="mt-5 space-y-3 text-gray-600 dark:text-gray-300">{['Tüm premium kitaplara erişim', 'Hazırlanmış çeviri verileri', 'Okuma ilerlemesi'].map(feature => <li key={feature} className="flex items-center gap-3"><Check className="text-green-500" size={18} />{feature}</li>)}</ul></section>
  </div>;
};

export default Pricing;
