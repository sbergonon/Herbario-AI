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
      envApiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || 
                  (import.meta as any).env.VITE_API_KEY || 
                  (import.meta as any).env.API_KEY || '';
    }
    
    // 2. Fallback to process.env.
    if (!envApiKey && typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      envApiKey = process.env.API_KEY;
    }
  } catch (e) {
    console.debug("Could not read environment variables directly.");
  }

  // Load manually saved key from LocalStorage on mount
  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('userApiKey');
      if (storedKey) {
        console.log("Loaded manual API Key from storage.");
        setUserApiKey(storedKey);
      } else {
        console.log("No manual API Key found in storage.");
      }
    } catch (e) {
      console.error("Failed to read userApiKey from localStorage", e);
    }
  }, []);

  // Debugging log to see which key is being active
  const effectiveApiKey = userApiKey || envApiKey;
  useEffect(() => {
    if (effectiveApiKey) {
        const source = userApiKey ? 'Manual (User Override)' : 'System (Environment)';
        const masked = effectiveApiKey.length > 5 ? `${effectiveApiKey.substring(0, 5)}...` : '***';
        console.log(`[ApiKeyContext] Active Key Source: ${source}. Key preview: ${masked}`);
    } else {
        console.log("[ApiKeyContext] No API Key currently configured.");
    }
  }, [effectiveApiKey, userApiKey]);

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