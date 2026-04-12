import { useEffect, useState, useContext, createContext } from 'react';
import {
  onAuthStateChange,
  getCurrentUser,
  signIn,
  signUp,
  signOut as authServiceSignOut,
} from '../services/authService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen to auth state changes on mount
  useEffect(() => {
    setLoading(true);
    let unsubscribe = () => {};

    const initAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        unsubscribe = onAuthStateChange((newSession, event) => {
          setSession(newSession);
          setUser(newSession?.user || null);
          setError(null);
        });
      } catch (err) {
        console.error('Auth init error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await signIn(email, password);
      setUser(result.user);
      setSession(result.session);
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Login failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, fullName) => {
    setLoading(true);
    setError(null);
    try {
      const result = await signUp(email, password, fullName);
      setUser(result.user);
      setSession(result.session);
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Signup failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await authServiceSignOut();
      setUser(null);
      setSession(null);
    } catch (err) {
      const errorMsg = err.message || 'Logout failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
