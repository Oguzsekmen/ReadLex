import React, { FormEvent, useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, Globe, Loader2 } from 'lucide-react';
import {
  getAuthErrorMessage,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail
} from '../services/auth';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lang, setLang] = useState<'TR' | 'EN'>('TR');

  const handleEmailAuth = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsLoading(true);
    try {
      if (isLogin) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(name, email, password);
        setNotice(lang === 'TR'
          ? 'Hesabınız oluşturuldu. Doğrulama e-postasını kontrol edin.'
          : 'Your account was created. Check your email for verification.');
      }
      // The App-level Firebase auth observer owns navigation and profile loading.
    } catch (err) {
      setError(getAuthErrorMessage(err, lang));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setNotice('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getAuthErrorMessage(err, lang));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsLoading(true);
    try {
      await sendPasswordReset(email);
      // Deliberately generic confirmation helps avoid exposing account existence.
      setNotice(lang === 'TR'
        ? 'Bu adres için hesap varsa şifre sıfırlama e-postası gönderildi.'
        : 'If an account exists for this address, a reset email has been sent.');
    } catch (err) {
      setError(getAuthErrorMessage(err, lang));
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => { setError(''); setNotice(''); };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#F0F4F8] dark:bg-gray-900 px-4 py-[max(1rem,var(--safe-top))] font-sans relative overflow-y-auto">
      <div className="absolute top-0 left-0 w-96 h-96 bg-brand-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      <button onClick={() => setLang(prev => prev === 'TR' ? 'EN' : 'TR')} className="absolute top-6 right-6 z-20 flex items-center bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-md font-bold text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700">
        <Globe size={18} className="mr-2 text-brand-500" />{lang === 'TR' ? 'Türkçe' : 'English'}
      </button>

      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-white/50 dark:border-gray-700">
        <div className="bg-gradient-to-tr from-brand-600 to-fun-pink p-8 text-center relative">
          <div className="flex justify-center mb-4"><div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3"><BookOpen size={28} strokeWidth={3} /></div></div>
          <h1 className="text-3xl font-black text-white mb-1">ReadLex</h1>
          <p className="text-brand-100 font-bold text-sm">{lang === 'TR' ? 'Eğlenceli İngilizce Okuma' : 'Fun English Reading'}</p>
        </div>

        <div className="p-8 space-y-5">
          {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-start border border-red-100"><AlertCircle size={20} className="mr-2 shrink-0 mt-0.5" />{error}</div>}
          {notice && <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm font-bold flex items-start border border-green-100"><CheckCircle2 size={20} className="mr-2 shrink-0 mt-0.5" />{notice}</div>}

          {isResetMode ? (
            <form onSubmit={handleReset} className="space-y-4">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{lang === 'TR' ? 'Şifre sıfırla' : 'Reset password'}</h2>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 rounded-xl border-2 border-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-brand-500" />
              <button disabled={isLoading} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-black py-3 rounded-xl flex justify-center">{isLoading ? <Loader2 className="animate-spin" /> : (lang === 'TR' ? 'Sıfırlama bağlantısı gönder' : 'Send reset link')}</button>
              <button type="button" onClick={() => { setIsResetMode(false); clearMessages(); }} className="w-full text-sm font-bold text-brand-600">{lang === 'TR' ? 'Girişe dön' : 'Back to sign in'}</button>
            </form>
          ) : (
            <>
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {!isLogin && <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'TR' ? 'Adınız' : 'Your name'} className="w-full p-3 rounded-xl border-2 border-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-brand-500" />}
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 rounded-xl border-2 border-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-brand-500" />
                <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder={lang === 'TR' ? 'Şifre' : 'Password'} className="w-full p-3 rounded-xl border-2 border-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:border-brand-500" />
                <button disabled={isLoading} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-black py-3 rounded-xl flex justify-center">{isLoading ? <Loader2 className="animate-spin" /> : (isLogin ? (lang === 'TR' ? 'Giriş yap' : 'Sign in') : (lang === 'TR' ? 'Hesap oluştur' : 'Create account'))}</button>
              </form>
              <div className="flex justify-between text-sm font-bold">
                <button type="button" onClick={() => { setIsLogin(value => !value); clearMessages(); }} className="text-brand-600">{isLogin ? (lang === 'TR' ? 'Hesap oluştur' : 'Create an account') : (lang === 'TR' ? 'Giriş yap' : 'Sign in')}</button>
                {isLogin && <button type="button" onClick={() => { setIsResetMode(true); clearMessages(); }} className="text-gray-500 dark:text-gray-300">{lang === 'TR' ? 'Şifremi unuttum' : 'Forgot password?'}</button>}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400"><div className="h-px bg-gray-200 flex-1" />{lang === 'TR' ? 'veya' : 'or'}<div className="h-px bg-gray-200 flex-1" /></div>
              <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full bg-white dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center shadow-sm active:scale-[0.98]">
                {isLoading ? <Loader2 className="animate-spin" /> : (lang === 'TR' ? 'Google ile devam et' : 'Continue with Google')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
