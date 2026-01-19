import React, { useState } from 'react';
import { User, PlanType } from '../types';
import { Check, CreditCard, Lock, Sparkles, Star, Crown } from 'lucide-react';

interface PricingProps {
  user: User;
  onUpgrade: (plan: PlanType) => void;
}

const Pricing: React.FC<PricingProps> = ({ user, onUpgrade }) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('YEARLY');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Payment Form State
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simulate API Call
    setTimeout(() => {
      onUpgrade(selectedPlan);
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
          Unlock Unlimited <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-fun-pink">ReadLex</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Your 3-day trial has ended. Choose a plan to continue your journey!
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Monthly Plan */}
        <div 
          onClick={() => setSelectedPlan('MONTHLY')}
          className={`relative p-8 rounded-3xl border-2 cursor-pointer transition-all hover:scale-105 bg-white dark:bg-gray-800 ${
            selectedPlan === 'MONTHLY' 
              ? 'border-brand-500 shadow-2xl shadow-brand-500/20' 
              : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'
          }`}
        >
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Monthly</h3>
          <div className="flex items-baseline mb-6">
            <span className="text-4xl font-black text-brand-600">$9.99</span>
            <span className="text-gray-500 ml-2">/ month</span>
          </div>
          <ul className="space-y-4 mb-8">
            {['Unlimited Books', 'Advanced Quizzes', 'Personal Vocabulary'].map((feat, i) => (
              <li key={i} className="flex items-center text-gray-700 dark:text-gray-300">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3">
                  <Check size={14} strokeWidth={3} />
                </div>
                {feat}
              </li>
            ))}
          </ul>
        </div>

        {/* Yearly Plan (Best Value) */}
        <div 
          onClick={() => setSelectedPlan('YEARLY')}
          className={`relative p-8 rounded-3xl border-2 cursor-pointer transition-all hover:scale-105 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-gray-800 ${
            selectedPlan === 'YEARLY' 
              ? 'border-fun-pink shadow-2xl shadow-fun-pink/30' 
              : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="absolute top-0 right-0 bg-gradient-to-r from-orange-400 to-fun-pink text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl rounded-tr-2xl shadow-lg">
            BEST VALUE
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
             Yearly <Sparkles className="ml-2 text-yellow-400 fill-current" size={20} />
          </h3>
          <div className="flex items-baseline mb-6">
            <span className="text-4xl font-black text-gray-900 dark:text-white">$79.99</span>
            <span className="text-gray-500 ml-2">/ year</span>
          </div>
          <p className="text-green-600 font-bold text-sm mb-6 bg-green-100 inline-block px-3 py-1 rounded-full">Save 33%</p>
          <ul className="space-y-4 mb-8">
            {['Everything in Monthly', 'Offline Mode', 'Priority Support', 'Access to Beta Features'].map((feat, i) => (
              <li key={i} className="flex items-center text-gray-700 dark:text-gray-300">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mr-3">
                  <Check size={14} strokeWidth={3} />
                </div>
                {feat}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Payment Form */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-700">
        <div className="flex items-center mb-6">
          <div className="p-3 bg-brand-100 rounded-xl text-brand-600 mr-4">
            <CreditCard size={24} />
          </div>
          <h2 className="text-2xl font-bold dark:text-white">Payment Details</h2>
        </div>

        <form onSubmit={handlePayment} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Name on Card</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-4 focus:ring-brand-100 outline-none transition-all font-bold"
              placeholder="John Doe"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Card Number</label>
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
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Expiry Date</label>
              <input 
                required
                value={expiry}
                onChange={e => setExpiry(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-4 focus:ring-brand-100 outline-none transition-all text-center"
                placeholder="MM/YY"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">CVC</label>
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
            Payments are secure and encrypted.
          </div>

          <button 
            type="submit"
            disabled={isProcessing}
            className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-black text-xl rounded-xl shadow-lg shadow-brand-500/30 transform transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:scale-100"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center"><Sparkles className="animate-spin mr-2" /> Processing...</span>
            ) : (
              `Pay $${selectedPlan === 'MONTHLY' ? '9.99' : '79.99'}`
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Pricing;