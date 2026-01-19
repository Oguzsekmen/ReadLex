import React, { useState } from 'react';
import { User } from '../types';
import { User as UserIcon, Mail, Settings, Shield } from 'lucide-react';

interface ProfileProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdate }) => {
  const [name, setName] = useState(user.name);
  const [newPassword, setNewPassword] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API update
    onUpdate({ ...user, name });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    setNewPassword('');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold dark:text-white mb-8">My Profile</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-brand-50 dark:bg-brand-900/20 p-8 flex items-center gap-6">
          <div className="w-20 h-20 bg-brand-200 dark:bg-brand-800 rounded-full flex items-center justify-center text-3xl font-bold text-brand-700 dark:text-brand-300 border-4 border-white dark:border-gray-800 shadow-md">
            {user.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
            <p className="text-gray-500 dark:text-gray-400 flex items-center mt-1">
              <Mail size={16} className="mr-2" /> {user.email}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Display Name</label>
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

          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <Shield size={20} className="mr-2 text-brand-500" />
              Security
            </h3>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Change Password</label>
            <div className="relative">
              <Settings className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="password"
                placeholder="Enter new password to change"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <p className="text-xs text-gray-500">Leave blank if you don't want to change it.</p>
          </div>

          <div className="pt-4 flex items-center gap-4">
            <button
              type="submit"
              className="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition-all shadow-md shadow-brand-500/20"
            >
              Save Changes
            </button>
            {isSaved && (
              <span className="text-green-600 font-medium animate-in fade-in">Saved successfully!</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;