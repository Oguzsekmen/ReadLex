import React, { useState, useEffect } from 'react';
import { Book, User, CEFRLevel } from '../types';
import { getBooks, saveBook, deleteBook, getUsers, saveUser, deleteUser } from '../services/storage';
import { Trash2, Edit, Plus, Users, Book as BookIcon, Save, X, Image as ImageIcon } from 'lucide-react';
import { t } from '../services/i18n';

interface AdminPanelProps {
  currentUser: User;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'BOOKS' | 'USERS'>('BOOKS');
  
  // Data
  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsersList] = useState<User[]>([]);
  
  // Forms
  const [isEditingBook, setIsEditingBook] = useState(false);
  const [currentBook, setCurrentBook] = useState<Partial<Book>>({});

  const [isEditingUser, setIsEditingUser] = useState(false);
  const [targetUser, setTargetUser] = useState<Partial<User>>({});

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setBooks(getBooks());
    setUsersList(getUsers());
  };

  // --- Book Handlers ---
  const handleEditBook = (book?: Book) => {
    setCurrentBook(book || { 
      id: '', title: '', author: '', level: 'A1', coverUrl: 'https://picsum.photos/300/450', content: '', excerpt: '', totalWords: 0 
    });
    setIsEditingBook(true);
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
      totalWords: currentBook.content!.split(' ').length
    };

    saveBook(bookToSave);
    setIsEditingBook(false);
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
    setTargetUser(u || {
      id: '', name: '', email: '', role: 'USER', password: ''
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

    const userToSave: User = {
      id: targetUser.id || 'u-' + Date.now(),
      email: targetUser.email!,
      name: targetUser.name!,
      password: targetUser.password || '123456',
      role: (targetUser.role as any) || 'USER',
      languagePreference: targetUser.languagePreference || 'TR',
      streak: targetUser.streak || 0,
      xp: targetUser.xp || 0,
      subscriptionStatus: targetUser.subscriptionStatus || 'TRIAL',
      plan: targetUser.plan || 'FREE',
      trialEndsAt: targetUser.trialEndsAt || (Date.now() + 3 * 24 * 60 * 60 * 1000)
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
                 <div className="col-span-full">
                   <label className="block text-sm font-bold text-gray-500 mb-1">{t('excerpt', lang)}</label>
                   <input className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={currentBook.excerpt || ''} onChange={e => setCurrentBook({...currentBook, excerpt: e.target.value})} />
                 </div>
                 <div className="col-span-full">
                   <label className="block text-sm font-bold text-gray-500 mb-1">{t('content', lang)}</label>
                   <textarea rows={10} className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" value={currentBook.content || ''} onChange={e => setCurrentBook({...currentBook, content: e.target.value})} />
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
                     <th className="p-3">{t('level', lang)}</th>
                     <th className="p-3">{t('actions', lang)}</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {books.map(b => (
                    <tr key={b.id}>
                      <td className="p-3"><img src={b.coverUrl} className="w-10 h-14 object-cover rounded" /></td>
                      <td className="p-3 font-bold dark:text-white">{b.title}</td>
                      <td className="p-3"><span className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-xs font-bold">{b.level}</span></td>
                      <td className="p-3 flex gap-2">
                        <button onClick={() => handleEditBook(b)} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Edit size={16} /></button>
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
                     <th className="p-3">{t('role', lang)}</th>
                     <th className="p-3">{t('actions', lang)}</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="p-3 dark:text-white">{u.email}</td>
                      <td className="p-3 font-bold dark:text-white">{u.name}</td>
                      <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span></td>
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
    </div>
  );
};

export default AdminPanel;