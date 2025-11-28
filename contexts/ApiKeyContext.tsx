import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

interface ApiKeyContextState {
  userApiKey: string | null;
  effectiveApiKey: string | null;
  isUserProvided: boolean;
  saveApiKey: (key: string) => void;
  clearApiKey: () => void;
}

const ApiKeyContext = createContext<ApiKeyContextState | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userApiKey, setUserApiKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('userApiKey');
      if (storedKey) {
        setUserApiKey(storedKey);
      }
    } catch (e) {
      console.error("Failed to read userApiKey from localStorage", e);
    }
  }, []);

  const saveApiKey = (key: string) => {
    const trimmedKey = key.trim();
    if (trimmedKey) {
      localStorage.setItem('userApiKey', trimmedKey);
      setUserApiKey(trimmedKey);
    }
  };

  const clearApiKey = () => {
    localStorage.removeItem('userApiKey');
    setUserApiKey(null);
  };
  
  // Logic to retrieve the Environment Key safely.
  // We prioritize VITE_GEMINI_API_KEY from import.meta.env as this is the standard way 
  // for users to provide their own keys in a Vite project (e.g. via .env.local).
  let envApiKey = '';
  try {
    // 1. Check Vite specific variables first.
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      envApiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (import.meta as any).env.API_KEY || '';
    }
    
    // 2. If not found in Vite env, check process.env (fallback for system vars or container injection)
    // Only use this if envApiKey is still empty to ensure user's .env.local takes precedence.
    if (!envApiKey && typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      envApiKey = process.env.API_KEY;
    }
  } catch (e) {
    // Fail silently if accessing env vars fails
    console.debug("Could not read environment variables directly.");
  }

  // The effective key is the User's manual key (UI) if present, otherwise the Environment key.
  const effectiveApiKey = userApiKey || envApiKey;

  const value: ApiKeyContextState = {
    userApiKey,
    effectiveApiKey,
    isUserProvided: !!userApiKey,
    saveApiKey,
    clearApiKey,
  };

  return (
    <ApiKeyContext.Provider value={value}>
      {children}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = (): ApiKeyContextState => {
  const context = useContext(ApiKeyContext);
  if (context === undefined) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
};