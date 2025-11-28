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
  // 1. Checks standard process.env.API_KEY (Node/System standard)
  // 2. Checks import.meta.env.VITE_GEMINI_API_KEY (Vite standard)
  let envApiKey = '';
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      envApiKey = process.env.API_KEY;
    } else if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      envApiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (import.meta as any).env.API_KEY || '';
    }
  } catch (e) {
    // Fail silently if accessing env vars fails
    console.debug("Could not read environment variables directly.");
  }

  // The effective key is the User's manual key if present, otherwise the Environment key.
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