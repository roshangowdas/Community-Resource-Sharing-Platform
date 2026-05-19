import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onIdTokenChanged, 
  signInWithPopup,
  signOut,
  User as FirebaseUser,
  getIdToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { safeFetch } from '../lib/api';

interface AuthContextType {
  user: any;
  token: string | null;
  getFreshToken: () => Promise<string | null>;
  apiFetch: (url: string, options?: RequestInit) => Promise<{ ok: boolean; status: number; data: any }>;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isOffline: boolean;
  isConnecting: boolean;
  dbAuthError: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [dbAuthError, setDbAuthError] = useState(false);

  // Function to sync Mongo user data
  const syncProfile = async (firebaseUser: FirebaseUser) => {
    try {
      const currentToken = await getIdToken(firebaseUser);
      setToken(currentToken);
      localStorage.setItem('token', currentToken);
      
      const { ok, data: mongoUser } = await safeFetch('/api/users/profile', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      
      const status = mongoUser?.status;
      setIsOffline(status === 'maintenance' || status === 'connecting');
      setIsConnecting(status === 'connecting');
      setDbAuthError(mongoUser?.isAuthError || false);

      if (ok && status !== 'maintenance' && status !== 'connecting') {
        const userObj = {
          id: mongoUser._id,
          uid: firebaseUser.uid,
          firebaseUid: firebaseUser.uid,
          name: mongoUser.name || firebaseUser.displayName || 'Neighbor',
          email: mongoUser.email || firebaseUser.email,
          avatar: mongoUser.avatar || firebaseUser.photoURL,
          rating: mongoUser.rating || 0,
          reviewCount: mongoUser.reviewCount || 0,
          impactScore: mongoUser.impactScore || 0,
          isAdmin: mongoUser.isAdmin || false,
          isTemporary: !!mongoUser.isTemporary
        };
        setUser(userObj);
        localStorage.setItem('user', JSON.stringify(userObj));
      } else {
        const userObj = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          firebaseUid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Neighbor',
          email: firebaseUser.email,
          avatar: firebaseUser.photoURL,
          isTemporary: true
        };
        setUser(userObj);
      }
    } catch (err) {
      console.error('Error syncing auth state:', err);
    }
  };

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await syncProfile(firebaseUser);
      } else {
        setToken(null);
        setUser(null);
        setIsOffline(false);
        setIsConnecting(false);
        setDbAuthError(false);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Health check poller if offline
  useEffect(() => {
    if (!isOffline || !auth?.currentUser) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        
        setDbAuthError(data.isAuthError || false);

        if (data.database === 'connected') {
          console.log('[Auth Health] Node detected reconnection. Syncing profile...');
          await syncProfile(auth.currentUser!);
        } else if (data.readyState === 2) {
          setIsConnecting(true);
        } else {
          setIsConnecting(false);
        }
      } catch (e) {
        // Still down or network error
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isOffline]);

  // Helper to ensure we always have the latest token
  const getFreshToken = async (): Promise<string | null> => {
    if (!auth?.currentUser) return null;
    try {
      const newToken = await getIdToken(auth.currentUser, true);
      setToken(newToken);
      localStorage.setItem('token', newToken);
      return newToken;
    } catch (err) {
      console.error('Failed to get fresh token:', err);
      return null;
    }
  };

  /**
   * Powerful fetch wrapper that:
   * 1. Automatically attaches the latest Bearer token
   * 2. Handles token refresh and retry if the server returns 401/expired
   */
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    // Ensure we have some token to start with
    const currentToken = token || await getFreshToken();
    
    const requestOptions = {
      ...options,
      headers: {
        'Authorization': `Bearer ${currentToken}`,
        ...(options.headers || {})
      }
    };
    
    return safeFetch(url, requestOptions, getFreshToken);
  };

  const loginWithGoogle = async () => {
    if (!auth) throw new Error('Authentication system not configured.');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (!auth) throw new Error('Authentication system not configured.');
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Email login error:', error);
      throw error;
    }
  };

  const registerWithEmail = async (name: string, email: string, pass: string) => {
    if (!auth) throw new Error('Authentication system not configured.');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, getFreshToken, apiFetch, loginWithGoogle, loginWithEmail, registerWithEmail, logout, isLoading, isOffline, isConnecting, dbAuthError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
