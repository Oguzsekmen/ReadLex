import React, { useState, useEffect } from 'react';
import { User, PlanType, PlanConfig } from '../types';
import { Check, CreditCard, Lock, Sparkles, Star, Crown, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { getPlans } from '../services/storage';
import { t } from '../services/i18n';

interface PricingProps {
  user: User;
  onUpgrade: (plan: PlanType) => void;
}

const Pricing: React.FC<PricingProps> = ({ user, onUpgrade }) => {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  
  // Payment Form State
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{number?: string, expiry?: string, cvc?: string, name?: string}>({});
  
  const lang = user.languagePreference;

  useEffect(() => {
    const loadPlans = async () => {
      const allPlans = await getPlans();
      const paidPlans = allPlans.filter(p => p.price > 0);
      setPlans(paidPlans);
      if (paidPlans.length > 0) {
          const yearly = paidPlans.find(p => p.durationDays >= 365);
          setSelectedPlan(yearly ? yearly.id : paidPlans[0].id);
      }
    };
    loadPlans();
  }, []);

  // --- Utility: Luhn Algorithm for Card Validation ---
  const isValidLuhn = (val: string) => {
    let sum = 0;
    let shouldDouble = false;
    // loop through values starting at the rightmost side
    for (let i = val.length - 1; i >= 0; i--) {
      let digit = parseInt(val.charAt(i));

      if (shouldDouble) {
        if ((digit *= 2) > 9) digit -= 9;
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return (sum % 10) === 0;
  };

  // --- Formatters ---
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const validateForm = () => {
    const newErrors: any = {};
    const cleanNumber = cardNumber.replace(/\s/g, '');
    
    // 1. Validate Card Number
    if (cleanNumber.length < 15 || cleanNumber.length > 16) {
        newErrors.number = lang === 'TR' ? "Kart numarası eksik." : "Invalid card length.";
    } else if (!isValidLuhn(cleanNumber)) {
        newErrors.number = lang === 'TR' ? "Geçersiz kart numarası." : "Invalid card number.";
    }

    // 2. Validate Expiry
    if (expiry.length !== 5) {
        newErrors.expiry = lang === 'TR' ? "Geçersiz tarih." : "Invalid date.";
    } else {
        const [mm, yy] = expiry.split('/').map(Number);
        const now = new Date();
        const currentYear = parseInt(now.getFullYear().toString().substr(-2));
        const currentMonth = now.getMonth() + 1;

        if (mm < 1 || mm > 12) newErrors.expiry = lang === 'TR' ? "Ay geçersiz." : "Invalid month.";
        else if (yy < currentYear || (yy === currentYear && mm < currentMonth)) {
            newErrors.expiry = lang === 'TR' ? "Kartın süresi dolmuş." : "Card expired.";
        }
    }

    // 3. Validate CVC
    if (cvc.length < 3) newErrors.cvc = "CVC error.";

    // 4. Validate Name
    if (name.trim().length < 3) newErrors.name = lang === 'TR' ? "İsim gerekli." : "Name required.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsProcessing(true);
    setPaymentStatus('IDLE');
    
    // Simulate Secure API Call
    setTimeout(() => {
      setIsProcessing(false);
      setPaymentStatus('SUCCESS');
      
      // Delay redirect to show success animation
      setTimeout(() => {
          onUpgrade(selectedPlan);
      }, 2000);
    }, 2500);
  };

  const currentPlanConfig = plans.find(p => p.id === selectedPlan);
  if (!currentPlanConfig) return <div className="p-10 text-center dark:text-white flex items-center justify-center"><Loader2 className="animate-spin mr-2"/> Loading plans...</div>;

  if (paymentStatus === 'SUCCESS') {
      return (
          <div className="max-w-2xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 text-green-600 dark:text-green-400">
                  <ShieldCheck size={48} strokeWidth={3} />
              </div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                  {lang === 'TR' ? 'Ödeme Başarılı!' : 'Payment Successful!'}
              </h2>
              <p className="text-gray-500 dark:text-gray-300 text-lg mb-8">
                  {lang === 'TR' 
                    ? `ReadLex PRO hesabınız (${currentPlanConfig.name}) aktifleştiriliyor...` 
                    : `Activating your ReadLex PRO (${currentPlanConfig.name}) account...`}
              </p>
              <Loader2 className="animate-spin text-brand-600" size={32} />
          </div>
      );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
          {t('unlockUnlimited', lang)} <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-fun-pink">ReadLex</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          {t('trialEnded', lang)}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {plans.map((plan) => {
           const isSelected = selectedPlan === plan.id;
           const isBestValue = plan.durationDays >= 365;

           return (
            <div 
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative p-8 rounded-3xl border-2 cursor-pointer transition-all hover:scale-105 bg-white dark:bg-gray-800 ${
                isSelected
                  ? 'border-brand-500 shadow-2xl shadow-brand-500/20 z-10 scale-105 ring-4 ring-brand-500/10' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'
              }`}
            >
              {isBestValue && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-orange-400 to-fun-pink text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl rounded-tr-2xl shadow-lg flex items-center gap-1">
                    <Star size={12} fill="currentColor" /> {t('bestValue', lang)}
                  </div>
              )}
              
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                {plan.name}
              </h3>
              
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-black text-brand-600">${plan.price}</span>
                <span className="text-gray-500 dark:text-gray-400 ml-2 text-sm font-bold">/ {plan.durationDays} {t('days', lang).toLowerCase()}</span>
              </div>
              
              {isBestValue && <p className="text-green-600 dark:text-green-400 font-bold text-sm mb-6 bg-green-100 dark:bg-green-900/30 inline-block px-3 py-1 rounded-full">{t('savePercent', lang)}</p>}

              <ul className="space-y-4 mb-8">
                {plan.features.map((feat, i) => (
                  <li key={i} className="flex items-center text-gray-700 dark:text-gray-300">
                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 flex items-center justify-center mr-3 shrink-0">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    {feat}
                  </li>
                ))}
              </ul>
              
              <div className={`w-full h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-colors ${isSelected ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                  {isSelected ? (lang === 'TR' ? 'Seçildi' : 'Selected') : (lang === 'TR' ? 'Seç' : 'Select')}
              </div>
            </div>
           );
        })}
      </div>

      {/* Secure Payment Form */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 md:p-10 shadow-xl border border-gray-100 dark:border-gray-700 max-w-2xl mx-auto relative overflow-hidden">
        {/* Security Badge */}
        <div className="absolute top-0 right-0 p-4 opacity-50">
             <Lock className="text-gray-300 dark:text-gray-600" size={100} />
        </div>

        <div className="flex items-center mb-8 relative z-10">
          <div className="p-4 bg-brand-100 dark:bg-brand-900/30 rounded-2xl text-brand-600 dark:text-brand-400 mr-5 shadow-inner">
            <CreditCard size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold dark:text-white">{t('paymentDetails', lang)}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                {lang === 'TR' ? 'Şu plana yükseltiyorsunuz:' : 'You are upgrading to:'} <span className="font-bold text-brand-600 dark:text-brand-400">{currentPlanConfig.name}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handlePayment} className="space-y-6 relative z-10">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('nameOnCard', lang)}</label>
            <input 
              required
              value={name}
              onChange={e => { setName(e.target.value); setErrors({...errors, name: ''}); }}
              className={`w-full px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border focus:ring-4 focus:ring-brand-100 outline-none transition-all font-bold ${errors.name ? 'border-red-500 focus:border-red-500' : 'border-gray-200 dark:border-gray-700 dark:text-white'}`}
              placeholder="John Doe"
            />
            {errors.name && <p className="text-red-500 text-xs font-bold mt-1 flex items-center"><AlertCircle size={12} className="mr-1"/>{errors.name}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('cardNumber', lang)}</label>
            <div className="relative">
              <input 
                required
                value={formatCardNumber(cardNumber)}
                onChange={e => { 
                    const val = e.target.value.replace(/\D/g, '').substring(0, 16);
                    setCardNumber(val); 
                    setErrors({...errors, number: ''});
                }}
                className={`w-full pl-12 pr-4 py-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border focus:ring-4 focus:ring-brand-100 outline-none transition-all font-mono tracking-wide text-lg ${errors.number ? 'border-red-500 focus:border-red-500' : 'border-gray-200 dark:border-gray-700 dark:text-white'}`}
                placeholder="0000 0000 0000 0000"
              />
              <CreditCard className="absolute left-4 top-4 text-gray-400" size={20} />
            </div>
            {errors.number && <p className="text-red-500 text-xs font-bold mt-1 flex items-center"><AlertCircle size={12} className="mr-1"/>{errors.number}</p>}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('expiryDate', lang)}</label>
              <input 
                required
                value={formatExpiry(expiry)}
                onChange={e => { 
                    setExpiry(e.target.value.replace(/[^0-9]/g, '').substring(0, 4));
                    setErrors({...errors, expiry: ''});
                }}
                className={`w-full px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border focus:ring-4 focus:ring-brand-100 outline-none transition-all text-center font-mono ${errors.expiry ? 'border-red-500 focus:border-red-500' : 'border-gray-200 dark:border-gray-700 dark:text-white'}`}
                placeholder="MM/YY"
              />
              {errors.expiry && <p className="text-red-500 text-xs font-bold mt-1 flex items-center"><AlertCircle size={12} className="mr-1"/>{errors.expiry}</p>}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('cvc', lang)}</label>
              <div className="relative">
                  <input 
                    required
                    type="password"
                    value={cvc}
                    onChange={e => {
                        setCvc(e.target.value.replace(/\D/g, '').substring(0, 3));
                        setErrors({...errors, cvc: ''});
                    }}
                    className={`w-full px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border focus:ring-4 focus:ring-brand-100 outline-none transition-all text-center font-mono tracking-widest ${errors.cvc ? 'border-red-500 focus:border-red-500' : 'border-gray-200 dark:border-gray-700 dark:text-white'}`}
                    placeholder="•••"
                  />
                  <Lock className="absolute right-4 top-4 text-gray-400 opacity-50" size={16} />
              </div>
              {errors.cvc && <p className="text-red-500 text-xs font-bold mt-1 flex items-center"><AlertCircle size={12} className="mr-1"/>{errors.cvc}</p>}
            </div>
          </div>

          <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-gray-900/50 py-3 rounded-lg">
            <Lock size={12} className="mr-2" />
            {t('securePayment', lang)} (256-bit SSL Encrypted)
          </div>

          <button 
            type="submit"
            disabled={isProcessing}
            className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-black text-xl rounded-xl shadow-lg shadow-brand-500/30 transform transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:scale-100 flex items-center justify-center"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center"><Loader2 className="animate-spin mr-3" /> {t('processing', lang)}</span>
            ) : (
              `${t('pay', lang)} $${currentPlanConfig.price}`
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Pricing;