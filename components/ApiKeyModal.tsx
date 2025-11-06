import React, { useState, useEffect } from 'react';
import { useApiKey } from '../contexts/ApiKeyContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Icon } from './Icons';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
  const { userApiKey, saveApiKey, clearApiKey, isUserProvided } = useApiKey();
  const { t } = useLanguage();
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    setApiKeyInput(userApiKey || '');
  }, [userApiKey, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveApiKey(apiKeyInput);
    onSave();
    onClose();
  };

  const handleClear = () => {
    clearApiKey();
    setApiKeyInput('');
  };

  const link = `<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">Google AI Studio</a>`;
  const helpText = t('getYourApiKey').replace('{link}', link);


  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-green-900 dark:text-emerald-200">{t('manageApiKey')}</h2>
            <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        <p className="text-gray-600 dark:text-slate-400 mb-4 text-sm">
          {t('apiKeyModalTitle')}
        </p>

        <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('yourApiKeyLabel')}</label>
            <input 
              id="apiKey"
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={t('apiKeyPlaceholder')}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button 
                onClick={handleSave} 
                className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50"
                disabled={!apiKeyInput.trim()}
            >
                {t('saveAndRetry')}
            </button>
            {isUserProvided && (
                <button onClick={handleClear} className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">
                    {t('clearKey')}
                </button>
            )}
        </div>

        <p className="mt-4 text-xs text-gray-500 dark:text-slate-400" dangerouslySetInnerHTML={{ __html: helpText }} />
      </div>
    </div>
  );
};