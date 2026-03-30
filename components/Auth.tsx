
import React, { useState } from 'react';
import { User } from '../types';
import { saveUser, getUserByEmail, getUserById } from '../services/storage';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup } from 'firebase/auth';
import { Mail, Lock, User as UserIcon, ArrowRight, BookOpen, Globe, Loader2, AlertCircle } from 'lucide-react';
import { t } from '../services/i18n';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lang, setLang] = useState<'TR' | 'EN'>('TR');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const normalizedEmail = email.toLowerCase().trim();

    try {
        // Dev Admin 'a'/'a' bypass logic
        const isDevBypass = normalizedEmail === 'a' && password === 'a';

        if (!isDevBypass && (!normalizedEmail.includes('@') || password.length < 4)) {
          throw new Error(lang === 'TR' ? 'Geçerli bir e-posta ve en az 4 haneli şifre girin.' : 'Please provide a valid email and a password (min 4 chars).');
        }

        if (isLogin) {
            const user = await getUserByEmail(normalizedEmail);
            if (user && user.password === password) {
                onLogin(user);
            } else {
                throw new Error(lang === 'TR' ? 'E-posta veya şifre hatalı.' : 'Invalid email or password.');
            }
        } else {
            const existing = await getUserByEmail(normalizedEmail);
            if (existing) {
                throw new Error(lang === 'TR' ? 'Bu e-posta zaten kayıtlı.' : 'This email is already registered.');
            }

            const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
            const newUser: User = {
                id: 'u-' + Date.now(),
                email: normalizedEmail,
                name: name || 'Yeni Kullanıcı',
                password: password,
                avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${name.replace(/\s/g,'')}`,
                role: 'USER',
                languagePreference: lang, 
                streak: 0,
                xp: 0,
                dailyGoal: 25,
                lastVisitDate: Date.now(),
                subscriptionStatus: 'ACTIVE',
                plan: 'TRAILER',
                trialEndsAt: Date.now() + THREE_DAYS_MS,
                subscriptionEndsAt: Date.now() + THREE_DAYS_MS
            };

            await saveUser(newUser);
            onLogin(newUser);
        }
    } catch (err: any) {
        setError(err.message || "Bir hata oluştu");
    } finally {
        setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) {
      setError(lang === 'TR' ? "Google servisi şu an kullanılamıyor. Lütfen e-posta ile giriş yapın." : "Google services not available. Use email login.");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      if (!fbUser) throw new Error("Google'dan kullanıcı bilgisi alınamadı.");

      const normalizedEmail = fbUser.email?.toLowerCase().trim();
      let appUser = await getUserById(fbUser.uid);
      
      if (!appUser && normalizedEmail) {
         appUser = await getUserByEmail(normalizedEmail);
      }

      if (!appUser) {
          const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
          appUser = {
            id: fbUser.uid,
            email: normalizedEmail || '',
            name: fbUser.displayName || 'Google Kullanıcısı',
            avatarUrl: fbUser.photoURL || `https://api.dicebear.com/9.x/adventurer/svg?seed=${fbUser.uid}`,
            role: 'USER',
            languagePreference: lang,
            streak: 0,
            xp: 0,
            dailyGoal: 25,
            lastVisitDate: Date.now(),
            subscriptionStatus: 'ACTIVE',
            plan: 'TRAILER',
            trialEndsAt: Date.now() + THREE_DAYS_MS,
            subscriptionEndsAt: Date.now() + THREE_DAYS_MS
          };
          await saveUser(appUser);
      }
      onLogin(appUser);

    } catch (err: any) {
      console.error("Google Login Error:", err);
      if (err.code === 'auth/operation-not-supported-in-this-environment') {
        setError(lang === 'TR' 
          ? 'Google ile giriş bu tarayıcıda/ortamda desteklenmiyor. Lütfen aşağıdaki e-posta formunu doldurun.' 
          : 'Google login is not supported in this environment. Please use email login.');
      } else {
        setError(err.message || "Google girişi başarısız.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] dark:bg-gray-900 px-4 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-brand-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
      
      <button 
        onClick={() => setLang(prev => prev === 'TR' ? 'EN' : 'TR')}
        className="absolute top-6 right-6 z-20 flex items-center bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-md font-bold text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700"
      >
        <Globe size={18} className="mr-2 text-brand-500" />
        {lang === 'TR' ? 'Türkçe' : 'English'}
      </button>

      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-white/50 dark:border-gray-700">
        <div className="bg-gradient-to-tr from-brand-600 to-fun-pink p-8 text-center relative">
           <div className="flex justify-center mb-4">
             <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3">
                <BookOpen size={28} strokeWidth={3} />
             </div>
           </div>
           <h1 className="text-3xl font-black text-white mb-1">ReadLex</h1>
           <p className="text-brand-100 font-bold text-sm">{lang === 'TR' ? 'Eğlenceli İngilizce Okuma' : 'Fun English Reading'}</p>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-start border border-red-100">
               <AlertCircle size={20} className="mr-2 shrink-0 mt-0.5" />
               <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-white dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-sm active:scale-[0.98]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C43.504,34.42,46,29.5,46,24C46,22.659,45.862,21.35,43.611,20.083z"/>
              </svg>
              <span>{lang === 'TR' ? 'Google ile Giriş Yap' : 'Sign in with Google'}</span>
            </button>

            <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-gray-100 dark:border-gray-700"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase tracking-widest">{lang === 'TR' ? 'veya e-posta' : 'or email'}</span>
                <div className="flex-grow border-t border-gray-100 dark:border-gray-700"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="relative">
                  <UserIcon className="absolute left-4 top-3.5 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder={lang === 'TR' ? 'Ad Soyad' : 'Full Name'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-gray-50 dark:border-gray-900 bg-gray-50 dark:bg-gray-900 dark:text-white outline-none font-bold text-sm"
                  />
                </div>
              )}
              
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder={lang === 'TR' ? 'E-posta' : 'Email'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-gray-50 dark:border-gray-900 bg-gray-50 dark:bg-gray-900 dark:text-white outline-none font-bold text-sm"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input
                  type="password"
                  placeholder={lang === 'TR' ? 'Şifre' : 'Password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-gray-50 dark:border-gray-900 bg-gray-50 dark:bg-gray-900 dark:text-white outline-none font-bold text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-brand-500/20 transition-all flex items-center justify-center"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : (
                    <>
                      {isLogin ? (lang === 'TR' ? 'Giriş Yap' : 'Sign In') : (lang === 'TR' ? 'Kayıt Ol' : 'Sign Up')}
                      <ArrowRight size={20} className="ml-2" />
                    </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-gray-500 font-bold hover:text-brand-600 transition-colors"
            >
              {isLogin 
                ? (lang === 'TR' ? "Hesabın yok mu? Kayıt Ol" : "Don't have an account? Sign Up") 
                : (lang === 'TR' ? "Zaten hesabın var mı? Giriş Yap" : "Already have an account? Sign In")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
