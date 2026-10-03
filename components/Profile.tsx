import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { User as UserIcon, Mail, Clock, Crown, Edit2, X } from 'lucide-react';
import { t } from '../services/i18n';
import { useNativeBackHandler } from '../hooks/useNativeAppLifecycle';

interface ProfileProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
}

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Trouble',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Scooby',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Missy',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Bandit',
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Happy',
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Cool',
  'https://api.dicebear.com/9.x/lorelei/svg?seed=Pepper',
  'https://api.dicebear.com/9.x/lorelei/svg?seed=Bubba',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Bear',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Cat'
];

const Profile: React.FC<ProfileProps> = ({ user, onUpdate }) => {
  const [name, setName] = useState(user.name);
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatarUrl || AVATAR_OPTIONS[0]);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{d: number, h: number, m: number} | null>(null);
  const lang = user.languagePreference;
  useNativeBackHandler(() => {
    if (!isAvatarModalOpen) return false;
    setIsAvatarModalOpen(false);
    return true;
  }, 300);

  // Sync state with props when user updates
  useEffect(() => {
    setName(user.name);
    if (user.avatarUrl) {
        setSelectedAvatar(user.avatarUrl);
    }
  }, [user]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create updated user object
    const updatedUser = { 
        ...user, 
        name,
        avatarUrl: selectedAvatar 
    };
    
    onUpdate(updatedUser);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Timer logic for live countdown
  useEffect(() => {
    const calculateTime = () => {
      // If Free plan (not trial), no countdown needed
      if (user.plan === 'FREE' && user.subscriptionStatus !== 'TRIAL') {
        setTimeLeft(null);
        return;
      }

      const end = user.subscriptionStatus === 'TRIAL' ? user.trialEndsAt : user.subscriptionEndsAt || 0;
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0 });
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft({ d, h, m });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [user]);

  // Determine display name for the plan
  const getPlanDisplayName = () => {
    if (user.subscriptionStatus === 'TRIAL') return t('trialLabel', lang);
    if (user.plan === 'FREE') return t('freePlan', lang);
    if (user.plan === 'MONTHLY') return t('monthlyPlan', lang);
    if (user.plan === 'YEARLY') return t('yearlyPlan', lang);
    return user.plan;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-black dark:text-white">{t('profile', lang)}</h1>
      
      {/* Subscription Card */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10">
          <div>
            <h2 className="text-xl font-bold flex items-center mb-2">
              <Crown className="mr-2 text-yellow-400" /> 
              {t('currentSubscription', lang)}
            </h2>
            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 mb-1 uppercase">
              {getPlanDisplayName()}
            </div>
            <p className="text-gray-300 text-sm font-medium opacity-80">
              {t('status', lang)}: <span className={user.subscriptionStatus === 'ACTIVE' || user.subscriptionStatus === 'TRIAL' ? 'text-green-400' : 'text-orange-400'}>{user.subscriptionStatus}</span>
            </p>
          </div>
          
          <div className="mt-4 md:mt-0 bg-white/10 backdrop-blur-md rounded-xl p-4 min-w-[180px]">
            <div className="text-sm text-gray-300 font-bold uppercase mb-1 flex items-center">
              <Clock size={14} className="mr-1" /> {t('remaining', lang)}
            </div>
            
            <div className="text-2xl font-bold font-mono">
               {timeLeft === null ? (
                 <span>∞ {t('unlimited', lang)}</span>
               ) : (
                 <div className="flex gap-2">
                    <div className="flex flex-col items-center">
                       <span>{timeLeft.d}</span>
                       <span className="text-[10px] uppercase opacity-60">{t('days', lang)}</span>
                    </div>
                    <span>:</span>
                    <div className="flex flex-col items-center">
                       <span>{timeLeft.h}</span>
                       <span className="text-[10px] uppercase opacity-60">{t('hours', lang)}</span>
                    </div>
                    <span>:</span>
                    <div className="flex flex-col items-center">
                       <span>{timeLeft.m}</span>
                       <span className="text-[10px] uppercase opacity-60">{t('minutes', lang)}</span>
                    </div>
                 </div>
               )}
            </div>

            {timeLeft !== null && (
              <div className="text-xs text-gray-400 mt-2 border-t border-white/10 pt-1">
                 {t('expires', lang)}: {new Date(user.subscriptionStatus === 'TRIAL' ? user.trialEndsAt : user.subscriptionEndsAt || 0).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-brand-50 dark:bg-brand-900/20 p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="relative group">
            <div 
                onClick={() => setIsAvatarModalOpen(true)}
                className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-800 shadow-lg cursor-pointer overflow-hidden hover:opacity-90 transition-opacity bg-white"
            >
                {/* KEY added to force re-render when selectedAvatar changes */}
                <img key={selectedAvatar} src={selectedAvatar} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <button 
                onClick={() => setIsAvatarModalOpen(true)}
                className="absolute bottom-0 right-0 bg-brand-600 text-white p-2 rounded-full shadow-md hover:bg-brand-700 transition-colors"
            >
                <Edit2 size={14} />
            </button>
          </div>
          
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
            <p className="text-gray-500 dark:text-gray-400 flex items-center justify-center md:justify-start mt-1">
              <Mail size={16} className="mr-2" /> {user.email}
            </p>
          </div>
        </div>

        {/* Avatar Selector Modal */}
        {isAvatarModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold dark:text-white">{lang === 'TR' ? 'Avatar Seç' : 'Choose Avatar'}</h3>
                        <button onClick={() => setIsAvatarModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400"><X /></button>
                    </div>
                    <div className="grid grid-cols-4 gap-4 max-h-[400px] overflow-y-auto p-2">
                        {AVATAR_OPTIONS.map((url, i) => (
                            <div 
                                key={i} 
                                onClick={() => { setSelectedAvatar(url); setIsAvatarModalOpen(false); }}
                                className={`aspect-square rounded-full border-2 cursor-pointer transition-all hover:scale-110 ${selectedAvatar === url ? 'border-brand-500 ring-2 ring-brand-200' : 'border-transparent hover:border-gray-300'}`}
                            >
                                <img src={url} alt={`Avatar ${i}`} className="w-full h-full rounded-full bg-gray-100" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <form onSubmit={handleSave} className="p-8 space-y-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('displayName', lang)}</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center gap-4">
            <button
              type="submit"
              className="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition-all shadow-md shadow-brand-500/20"
            >
              {t('saveChanges', lang)}
            </button>
            {isSaved && (
              <span className="text-green-600 font-medium animate-in fade-in">{t('saved', lang)}</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
