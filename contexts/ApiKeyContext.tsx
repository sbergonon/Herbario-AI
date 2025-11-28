import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

interface ApiKeyContextState {
  userApiKey: string | null;
  effectiveApiKey: string | null;
  isUserProvided: boolean;
  saveApiKey: (key: string) => void;
  clearApiKey: () => void;
  usingSystemKey: boolean;
}

const ApiKeyContext = createContext<ApiKeyContextState | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userApiKey, setUserApiKey] = useState<string | null>(null);

  // Logic to retrieve the Environment Key safely.
  // We prioritize VITE_GEMINI_API_KEY from import.meta.env as this is the standard way 
  // for users to provide their own keys in a Vite project.
  let envApiKey = '';
  try {
    // 1. Check Vite specific variables first.
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      envApiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (import.meta as any).env.API_KEY || '';
    }
    
    // 2. Fallback to process.env.
    if (!envApiKey && typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      envApiKey = process.env.API_KEY;
    }
  } catch (e) {
    console.debug("Could not read environment variables directly.");
  }

  useEffect(() => {
    try {
      // CRITICAL FIX: If we have a valid VITE_ key in the environment (which implies a fresh deploy/build),
      // we should prefer it over a potentially stale/broken key stored in localStorage.
      // This solves the loop where a user updates .env but the app keeps using the old cached key.
      if (envApiKey && envApiKey.length > 10) {
          // If local storage has a key, we check if we should clear it to enforce the env key
          const storedKey = localStorage.getItem('userApiKey');
          if (storedKey) {
              console.log("System environment key detected. Clearing manual local storage override to ensure fresh key is used.");
              localStorage.removeItem('userApiKey');
              setUserApiKey(null);
          }
      } else {
          // Only load from storage if no robust env key is found in the build
          const storedKey = localStorage.getItem('userApiKey');
          if (storedKey) {
            setUserApiKey(storedKey);
          }
      }
    } catch (e) {
      console.error("Failed to read userApiKey from localStorage", e);
    }
  }, [envApiKey]); // Re-run if envApiKey changes (unlikely at runtime, but good for correctness)

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
  
  // The effective key logic:
  // If userApiKey exists (manual override), use it. Otherwise use envApiKey.
  const effectiveApiKey = userApiKey || envApiKey;

  const value: ApiKeyContextState = {
    userApiKey,
    effectiveApiKey,
    isUserProvided: !!userApiKey,
    usingSystemKey: !userApiKey && !!envApiKey,
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