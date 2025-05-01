import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../data/supabaseClient';
import { useDispatch } from 'react-redux';
import { authStateChanged } from '../slices/authSlice';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ 
    error: any | null, 
    user: User | null 
  }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  useEffect(() => {
    // Normal authentication flow for production
    // Get session on load
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
      // Dispatch Redux action with initial session state
      console.log('[AuthProvider] Dispatching initial auth state');
      dispatch(authStateChanged({ session: initialSession }));
    }).catch(error => {
        console.error("[AuthProvider] Error getting initial session:", error);
         setLoading(false);
         // Dispatch null session if error occurs
         dispatch(authStateChanged({ session: null }));
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      console.log(`[AuthProvider] Auth state changed, event: ${_event}`);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      // Ensure loading is false after an update
      if (loading) setLoading(false);
      // Dispatch Redux action on auth state change
      dispatch(authStateChanged({ session: currentSession }));
    });

    return () => {
        console.log('[AuthProvider] Unsubscribing from auth state changes.');
        subscription.unsubscribe();
    };
  }, [dispatch]);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, username: string) => {
    try {
      // Create the Supabase Auth user.
      // Additional profile creation/linking is handled later by sagas 
      // triggered by the authStateChanged event (e.g., in authStateChangeSaga).
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          // Pass data like username here if needed by DB triggers/functions on auth.users insert
          data: { username } 
        }
      });
      
      // Return only the auth result.
      return { error, user: data?.user ?? null };

    } catch (error) {
      console.error('Unexpected error during signUp:', error);
      return { error, user: null };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value: AuthContextType = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for using the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}; 