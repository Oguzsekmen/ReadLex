import React, { useState, useEffect } from 'react';
import { Book, User, CEFRLevel, PlanConfig, PlanType, SubscriptionStatus } from '../types';
import { getBooks, saveBook, deleteBook, getUsers, saveUser, deleteUser, getPlans, savePlans } from '../services/storage';
import { Trash2, Edit, Plus, Users, Book as BookIcon, Save, X, Archive, DollarSign, Lock, CheckSquare, Square } from 'lucide-react';
import { t } from '../services/i18n';

interface AdminPanelProps {
  currentUser: User;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'BOOKS' | 'USERS' | 'PLANS'>('BOOKS');
  
  // Data
  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsersList] = useState<User[]>([]);
  const [plans, setPlansList] = useState<PlanConfig[]>([]);
  
  // Forms
  const [isEditingBook, setIsEditingBook] = useState(false);
  const [currentBook, setCurrentBook] = useState<Partial<Book>>({});

  const [isEditingUser, setIsEditingUser] = useState(false);
  const [targetUser, setTargetUser] = useState<Partial<User>>({});

  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [targetPlan, setTargetPlan] = useState<Partial<PlanConfig>>({});
  const [planFeaturesText, setPlanFeaturesText] = useState(''); 

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setBooks(getBooks());
    setUsersList(getUsers());
    setPlansList(getPlans());
  };

  // --- Book Handlers ---
  const handleEditBook = (book?: Book) => {
    setCurrentBook(book || { 
      id: '', title: '', author: '', level: 'A1', coverUrl: 'https://picsum.photos/300/450', content: '', excerpt: '', totalWords: 0, requiredPlan: ['FREE'], archived: false 
    });
    setIsEditingBook(true);
  };

  const togglePlanForBook = (plan: PlanType) => {
    const currentPlans = currentBook.requiredPlan || [];
    if (currentPlans.includes(plan)) {
      setCurrentBook({ ...currentBook, requiredPlan: currentPlans.filter(p => p !== plan) });
    } else {
      setCurrentBook({ ...currentBook, requiredPlan: [...currentPlans, plan] });
    }
  };

  const handleSaveBook = () => {
    if (!currentBook.title || !currentBook.content) return alert(t('fillAllFields', currentUser.languagePreference));

    const bookToSave: Book = {
      id: currentBook.id || 'b-' + Date.now(),
      title: currentBook.title!,
      author: currentBook.author || 'Unknown',
      level: currentBook.level as CEFRLevel,
      coverUrl: currentBook.coverUrl || '',
      content: currentBook.content!,
      excerpt: currentBook.excerpt || currentBook.content!.substring(0, 100),
      totalWords: currentBook.content!.split(' ').length,
      requiredPlan: currentBook.requiredPlan && currentBook.requiredPlan.length > 0 ? currentBook.requiredPlan : ['FREE'],
      archived: currentBook.archived || false
    };

    saveBook(bookToSave);
    setIsEditingBook(false);
    refreshData();
  };

  const handleArchiveBook = (book: Book) => {
    const updatedBook = { ...book, archived: !book.archived };
    saveBook(updatedBook);
    refreshData();
  };

  const handleDeleteBook = (id: string) => {
    if (confirm(t('confirmDelete', currentUser.languagePreference))) {
      deleteBook(id);
      refreshData();
    }
  };

  // --- User Handlers ---
  const handleEditUser = (u?: User) => {
    // If editing existing user, we copy their password. 
    // If Admin changes it in input, it updates.
    setTargetUser(u || {
      id: '', name: '', email: '', role: 'USER', password: '', plan: 'FREE', subscriptionStatus: 'ACTIVE'
    });
    setIsEditingUser(true);
  };

  const handleSaveUser = () => {
    if (!targetUser.email || !targetUser.name) return alert(t('fillAllFields', currentUser.languagePreference));
    
    // Simple email check for new users
    if (!targetUser.id) {
       const exists = users.find(u => u.email === targetUser.email);
       if(exists) return alert(t('emailExists', currentUser.languagePreference));
    }

    // Determine end date based on plan
    let endAt = targetUser.subscriptionEndsAt || Date.now();
    if (targetUser.plan !== 'FREE') {
       const planConfig = plans.find(p => p.id === targetUser.plan);
       if (planConfig) {
         endAt = Date.now() + (planConfig.durationDays * 24 * 60 * 60 * 1000);
       }
    }

    const userToSave: User = {
      id: targetUser.id || 'u-' + Date.now(),
      email: targetUser.email!,
      name: targetUser.name!,
      // Ensure password isn't lost if input was cleared by accident
      password: targetUser.password || '123456',
      role: (targetUser.role as any) || 'USER',
      languagePreference: targetUser.languagePreference || 'TR',
      streak: targetUser.streak || 0,
      xp: targetUser.xp || 0,
      dailyGoal: targetUser.dailyGoal || 25,
      lastVisitDate: targetUser.lastVisitDate || Date.now(),
      subscriptionStatus: targetUser.subscriptionStatus || 'ACTIVE',
      plan: targetUser.plan || 'FREE',
      trialEndsAt: targetUser.trialEndsAt || 0,
      subscriptionEndsAt: endAt
    };

    saveUser(userToSave);
    setIsEditingUser(false);
    refreshData();
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) return alert("You cannot delete yourself.");
    if (confirm(t('confirmDelete', currentUser.languagePreference))) {
      deleteUser(id);
      refreshData();
    }
  };

  // --- Plan Handlers ---
  const handleEditPlan = (p?: PlanConfig) => {
    if (p) {
        setTargetPlan(p);
        setPlanFeaturesText(p.features.join('\n'));
    } else {
        setTargetPlan({ id: '', name: '', price: 0, durationDays: 30, features: [] });
        setPlanFeaturesText('');
    }
    setIsEditingPlan(true);
  };

  const handleDeletePlan = (id: string) => {
      if (confirm("Are you sure you want to delete this plan?")) {
          const updatedPlans = plans.filter(p => p.id !== id);
          savePlans(updatedPlans);
          refreshData();
      }
  };

  const handleSavePlan = () => {
    if (!targetPlan.name) return alert("Plan name is required");
    
    const featuresArray = planFeaturesText.split('\n').map(f => f.trim()).filter(f => f.length > 0);
    
    // Auto-generate ID if new
    const planId = targetPlan.id || targetPlan.name?.toUpperCase().replace(/\s+/g, '_') || 'NEW_PLAN';

    const newPlanConfig: PlanConfig = {
        id: planId,
        name: targetPlan.name!,
        price: targetPlan.price || 0,
        durationDays: targetPlan.durationDays || 30,
        features: featuresArray
    };

    let updatedPlans = [...plans];
    const index = updatedPlans.findIndex(p => p.id === planId);
    
    if (index >= 0) {
        updatedPlans[index] = newPlanConfig;
    } else {
        updatedPlans.push(newPlanConfig);
    }

    savePlans(updatedPlans);
    setIsEditingPlan(false);
    refreshData();
  };

  const lang = currentUser.languagePreference;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold dark:text-white">{t('adminPanel', lang)}</h1>
      </div>

      <div className="flex space-x-4 mb-6">
        <button 
          onClick={() => setActiveTab('BOOKS')}
          className={`px-6 py-3 rounded-xl font-bold flex items-center ${activeTab === 'BOOKS' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
        >
          <BookIcon size={20} className="mr-2" /> {t('adminBooks', lang)}
        </button>
        <button 
          onClick={() => setActiveTab('USERS')}
          className={`px-6 py-3 rounded-xl font-bold flex items-center ${activeTab === 'USERS' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
        >
          <Users size={20} className="mr-2" /> {t('adminUsers', lang)}
        </button>
        <button 
          onClick={() => setActiveTab('PLANS')}
          className={`px-6 py-3 rounded-xl font-bold flex items-center ${activeTab === 'PLANS' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
        >
          <DollarSign size={20} className="mr-2" /> Paketler
        </button>
      </div>

      {/* --- BOOKS TAB --- */}
      {activeTab === 'BOOKS' && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold dark:text-white">Books List ({books.length})</h2>
            <button onClick={() => handleEditBook()} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center">
              <Plus size={18} className="mr-2" /> {t('addBook', lang)}
            </button>
          </div>

          {isEditingBook ? (
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl animate-in slide-in-from-top-4">
               <h3 className="font-bold text-lg mb-4 dark:text-white">{currentBook.id ? t('edit', lang) : t('addBook', lang)}</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-bold text-gray-500 mb-1">{t('title', lang)}</label>
                   <input className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={currentBook.title || ''} onChange={e => setCurrentBook({...currentBook, title: e.target.value})} />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-500 mb-1">{t('author', lang)}</label>
                   <input className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={currentBook.author || ''} onChange={e => setCurrentBook({...currentBook, author: e.target.value})} />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-500 mb-1">{t('level', lang)}</label>
                   <select className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={currentBook.level || 'A1'} onChange={e => setCurrentBook({...currentBook, level: e.target.value as CEFRLevel})}>
                      {['A1','A2','B1','B2','C1','C2'].map(l => <option key={l} value={l}>{l}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-500 mb-1">{t('coverUrl', lang)}</label>
                   <input className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={currentBook.coverUrl || ''} onChange={e => setCurrentBook({...currentBook, coverUrl: e.target.value})} />
                 </div>
                 
                 {/* Access Control - Checkboxes (Dynamic) */}
                 <div className="col-span-full">
                   <label className="block text-sm font-bold text-gray-500 mb-2">Required Plans (Select all that apply)</label>
                   <div className="flex gap-4 flex-wrap">
                      {plans.map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => togglePlanForBook(plan.id)}
                          className={`flex items-center px-4 py-2 rounded-lg border-2 font-bold transition-all ${
                            (currentBook.requiredPlan || []).includes(plan.id)
                              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {(currentBook.requiredPlan || []).includes(plan.id) ? (
                            <CheckSquare size={20} className="mr-2" />
                          ) : (
                            <Square size={20} className="mr-2" />
                          )}
                          {plan.name}
                        </button>
                      ))}
                   </div>
                 </div>

                 <div className="flex items-center pt-6">
                    <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={currentBook.archived || false} onChange={e => setCurrentBook({...currentBook, archived: e.target.checked})} className="w-5 h-5 text-brand-600 rounded" />
                      <span className="ml-2 font-bold text-gray-700 dark:text-gray-300">Archived (Hidden)</span>
                    </label>
                 </div>
                 
                 <div className="col-span-full">
                   <label className="block text-sm font-bold text-gray-500 mb-1">{t('excerpt', lang)}</label>
                   <input className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={currentBook.excerpt || ''} onChange={e => setCurrentBook({...currentBook, excerpt: e.target.value})} />
                 </div>
                 <div className="col-span-full">
                   <label className="block text-sm font-bold text-gray-500 mb-1">{t('content', lang)}</label>
                   <textarea rows={10} className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white font-mono text-sm leading-relaxed" value={currentBook.content || ''} onChange={e => setCurrentBook({...currentBook, content: e.target.value})} placeholder="Enter book content here. Use new lines for paragraphs." />
                 </div>
               </div>
               <div className="flex justify-end gap-3 mt-4">
                 <button onClick={() => setIsEditingBook(false)} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg font-bold">{t('cancel', lang)}</button>
                 <button onClick={handleSaveBook} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold">{t('save', lang)}</button>
               </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                   <tr>
                     <th className="p-3">Img</th>
                     <th className="p-3">{t('title', lang)}</th>
                     <th className="p-3">Access</th>
                     <th className="p-3">Status</th>
                     <th className="p-3">{t('actions', lang)}</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {books.map(b => (
                    <tr key={b.id} className={b.archived ? 'opacity-50 bg-gray-50 dark:bg-gray-900' : ''}>
                      <td className="p-3"><img src={b.coverUrl} className="w-10 h-14 object-cover rounded" /></td>
                      <td className="p-3 font-bold dark:text-white">{b.title}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {b.requiredPlan.map(p => (
                             <span key={p} className={`px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700`}>
                               {p}
                             </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        {b.archived ? <span className="text-red-500 font-bold text-xs flex items-center"><Archive size={12} className="mr-1"/> Archived</span> : <span className="text-green-500 font-bold text-xs">Active</span>}
                      </td>
                      <td className="p-3 flex gap-2">
                        <button onClick={() => handleEditBook(b)} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Edit size={16} /></button>
                        <button onClick={() => handleArchiveBook(b)} className="p-2 bg-yellow-100 text-yellow-600 rounded hover:bg-yellow-200" title="Archive/Unarchive">
                           <Archive size={16} />
                        </button>
                        <button onClick={() => handleDeleteBook(b.id)} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- USERS TAB --- */}
      {activeTab === 'USERS' && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
           <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold dark:text-white">User List ({users.length})</h2>
            <button onClick={() => handleEditUser()} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center">
              <Plus size={18} className="mr-2" /> {t('addUser', lang)}
            </button>
          </div>

          {isEditingUser ? (
             <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl animate-in slide-in-from-top-4">
                {/* ... existing user form ... */}
                <h3 className="font-bold text-lg mb-4 dark:text-white">{targetUser.id ? t('edit', lang) : t('addUser', lang)}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-1">{t('email', lang)}</label>
                    <input className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={targetUser.email || ''} onChange={e => setTargetUser({...targetUser, email: e.target.value})} disabled={!!targetUser.id} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-1">{t('displayName', lang)}</label>
                    <input className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={targetUser.name || ''} onChange={e => setTargetUser({...targetUser, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-1">{t('password', lang)}</label>
                    <input className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={targetUser.password || ''} onChange={e => setTargetUser({...targetUser, password: e.target.value})} placeholder={targetUser.id ? "Leave blank to keep same" : "Required"} />
                  </div>
                   <div>
                   <label className="block text-sm font-bold text-gray-500 mb-1">{t('role', lang)}</label>
                   <select className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={targetUser.role || 'USER'} onChange={e => setTargetUser({...targetUser, role: e.target.value as any})}>
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                   </select>
                 </div>
                 
                 {/* Admin User Management: Plan Assignment */}
                 <div className="col-span-full border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                    <h4 className="font-bold text-brand-600 mb-3">Subscription Management</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-500 mb-1">Plan</label>
                        <select className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={targetUser.plan || 'FREE'} onChange={e => setTargetUser({...targetUser, plan: e.target.value as PlanType})}>
                           {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-500 mb-1">Status</label>
                        <select className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={targetUser.subscriptionStatus || 'ACTIVE'} onChange={e => setTargetUser({...targetUser, subscriptionStatus: e.target.value as SubscriptionStatus})}>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="TRIAL">TRIAL</option>
                            <option value="EXPIRED">EXPIRED</option>
                        </select>
                      </div>
                    </div>
                 </div>

                </div>
                <div className="flex justify-end gap-3 mt-4">
                 <button onClick={() => setIsEditingUser(false)} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg font-bold">{t('cancel', lang)}</button>
                 <button onClick={handleSaveUser} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold">{t('save', lang)}</button>
               </div>
             </div>
          ) : (
             <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                   <tr>
                     <th className="p-3">{t('email', lang)}</th>
                     <th className="p-3">{t('displayName', lang)}</th>
                     <th className="p-3">Plan</th>
                     <th className="p-3">Status</th>
                     <th className="p-3">{t('actions', lang)}</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="p-3 dark:text-white">{u.email}</td>
                      <td className="p-3 font-bold dark:text-white">{u.name}</td>
                      <td className="p-3"><span className="bg-brand-50 text-brand-600 px-2 py-1 rounded text-xs font-bold">{u.plan}</span></td>
                       <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${u.subscriptionStatus === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{u.subscriptionStatus}</span></td>
                      <td className="p-3 flex gap-2">
                        <button onClick={() => handleEditUser(u)} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Edit size={16} /></button>
                        {u.role !== 'ADMIN' && (
                           <button onClick={() => handleDeleteUser(u.id)} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- PLANS TAB --- */}
      {activeTab === 'PLANS' && (
         <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold dark:text-white">Manage Subscription Plans</h2>
                <button onClick={() => handleEditPlan()} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center">
                   <Plus size={18} className="mr-2" /> Add Plan
                </button>
            </div>
            
            {isEditingPlan ? (
              <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl animate-in slide-in-from-top-4">
                  <h3 className="font-bold text-lg mb-4 dark:text-white">{targetPlan.id ? `Edit ${targetPlan.name}` : 'New Plan'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-bold text-gray-500 mb-1">Plan Name</label>
                        <input className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={targetPlan.name} onChange={e => setTargetPlan({...targetPlan, name: e.target.value})} />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-500 mb-1">Price</label>
                        <input type="number" step="0.01" className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={targetPlan.price} onChange={e => setTargetPlan({...targetPlan, price: parseFloat(e.target.value)})} />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-500 mb-1">Duration (Days)</label>
                        <input type="number" className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={targetPlan.durationDays} onChange={e => setTargetPlan({...targetPlan, durationDays: parseInt(e.target.value)})} />
                     </div>
                     <div className="col-span-full">
                        <label className="block text-sm font-bold text-gray-500 mb-1">Features (One per line)</label>
                        <textarea 
                          rows={5}
                          className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white font-mono text-sm" 
                          value={planFeaturesText} 
                          onChange={e => setPlanFeaturesText(e.target.value)} 
                          placeholder="Unlimited Books&#10;Advanced Quizzes&#10;Offline Mode"
                        />
                     </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                     <button onClick={() => setIsEditingPlan(false)} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg font-bold">{t('cancel', lang)}</button>
                     <button onClick={handleSavePlan} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold">{t('save', lang)}</button>
                  </div>
              </div>
            ) : (
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Price</th>
                        <th className="p-3">Duration</th>
                        <th className="p-3">Features Count</th>
                        <th className="p-3">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                     {plans.map(p => (
                       <tr key={p.id}>
                         <td className="p-3 font-mono text-sm dark:text-white">{p.id}</td>
                         <td className="p-3 font-bold dark:text-white">{p.name}</td>
                         <td className="p-3 text-brand-600 font-bold">${p.price}</td>
                         <td className="p-3 dark:text-gray-400">{p.durationDays} Days</td>
                         <td className="p-3 dark:text-gray-400">{p.features.length}</td>
                         <td className="p-3 flex gap-2">
                           <button onClick={() => handleEditPlan(p)} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Edit size={16} /></button>
                           <button onClick={() => handleDeletePlan(p.id)} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16} /></button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            )}
         </div>
      )}
    </div>
  );
};

export default AdminPanel;