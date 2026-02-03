import React, { useState, useEffect } from 'react';
import { User, PlanType, PlanConfig } from '../types';
import { Check, CreditCard, Lock, Sparkles, Star, Crown } from 'lucide-react';
import { getPlans } from '../services/storage';
import { t } from '../services/i18n';

interface PricingProps {
  user: User;
  onUpgrade: (plan: PlanType) => void;
}

const Pricing: React.FC<PricingProps> = ({ user, onUpgrade }) => {
  // Use first available paid plan as default or fallback
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Payment Form State
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  
  const lang = user.languagePreference;

  useEffect(() => {
    const allPlans = getPlans();
    // Filter for paid plans only
    const paidPlans = allPlans.filter(p => p.price > 0);
    setPlans(paidPlans);
    if (paidPlans.length > 0) {
        // Try to select yearly first, or first avail
        const yearly = paidPlans.find(p => p.durationDays >= 365);
        setSelectedPlan(yearly ? yearly.id : paidPlans[0].id);
    }
  }, []);

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simulate API Call
    setTimeout(() => {
      onUpgrade(selectedPlan);
      setIsProcessing(false);
    }, 2000);
  };

  const currentPlanConfig = plans.find(p => p.id === selectedPlan);
  if (!currentPlanConfig) return <div className="p-10 text-center dark:text-white">No subscription plans available.</div>;

  return (
    <div className="max-w-6xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
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
                  ? 'border-brand-500 shadow-2xl shadow-brand-500/20 z-10 scale-105' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'
              }`}
            >
              {isBestValue && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-orange-400 to-fun-pink text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl rounded-tr-2xl shadow-lg">
                    {t('bestValue', lang)}
                  </div>
              )}
              
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                {plan.name}
                {isBestValue && <Sparkles className="ml-2 text-yellow-400 fill-current" size={20} />}
              </h3>
              
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-black text-brand-600">${plan.price}</span>
                <span className="text-gray-500 ml-2 text-sm font-bold">/ {plan.durationDays} days</span>
              </div>
              
              {isBestValue && <p className="text-green-600 font-bold text-sm mb-6 bg-green-100 inline-block px-3 py-1 rounded-full">{t('savePercent', lang)}</p>}

              <ul className="space-y-4 mb-8">
                {plan.features.map((feat, i) => (
                  <li key={i} className="flex items-center text-gray-700 dark:text-gray-300">
                    <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 shrink-0">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
           );
        })}
      </div>

      {/* Payment Form */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-700 max-w-2xl mx-auto">
        <div className="flex items-center mb-6">
          <div className="p-3 bg-brand-100 rounded-xl text-brand-600 mr-4">
            <CreditCard size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold dark:text-white">{t('paymentDetails', lang)}</h2>
            <p className="text-gray-500 text-sm">You are upgrading to <span className="font-bold text-brand-600">{currentPlanConfig.name}</span></p>
          </div>
        </div>

        <form onSubmit={handlePayment} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('nameOnCard', lang)}</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-bold"
              placeholder="John Doe"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('cardNumber', lang)}</label>
            <div className="relative">
              <input 
                required
                value={cardNumber}
                onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').substring(0, 16))}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-mono"
                placeholder="0000 0000 0000 0000"
              />
              <CreditCard className="absolute left-4 top-3.5 text-gray-400" size={20} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('expiryDate', lang)}</label>
              <input 
                required
                value={expiry}
                onChange={e => setExpiry(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-4 focus:ring-brand-100 outline-none transition-all text-center"
                placeholder="MM/YY"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('cvc', lang)}</label>
              <input 
                required
                value={cvc}
                onChange={e => setCvc(e.target.value.replace(/\D/g, '').substring(0, 3))}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-4 focus:ring-brand-100 outline-none transition-all text-center"
                placeholder="123"
              />
            </div>
          </div>

          <div className="flex items-center justify-center text-sm text-gray-500 mb-4">
            <Lock size={14} className="mr-2" />
            {t('securePayment', lang)}
          </div>

          <button 
            type="submit"
            disabled={isProcessing}
            className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-black text-xl rounded-xl shadow-lg shadow-brand-500/30 transform transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:scale-100"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center"><Sparkles className="animate-spin mr-2" /> {t('processing', lang)}</span>
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