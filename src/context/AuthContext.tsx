import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../data/supabaseClient';

// Set this to true to bypass authentication for development
const DEV_MODE = true;
// Only used if DEV_MODE is true
const DEV_USER: User = {
  id: 'dev-user-id',
  app_metadata: {},
  user_metadata: { username: 'Developer' },
  aud: 'authenticated',
  created_at: new Date().toISOString()
};

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

  useEffect(() => {
    // If in dev mode, set the dev user and skip authentication
    if (DEV_MODE) {
      console.log('🔑 Development mode: Auto-login enabled');
      setUser(DEV_USER);
      // Create a mock session
      setSession({ 
        access_token: 'dev-token',
        refresh_token: 'dev-refresh-token',
        expires_in: 3600,
        expires_at: new Date().getTime() + 3600000,
        token_type: 'bearer',
        user: DEV_USER,
      } as Session);
      setLoading(false);
      return;
    }

    // Normal authentication flow for production
    // Get session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    if (DEV_MODE) {
      // Skip actual sign in for development
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, username: string) => {
    if (DEV_MODE) {
      // Skip actual sign up for development
      return { error: null, user: DEV_USER };
    }

    try {
      // Create auth user
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { username }
        }
      });
      
      if (error) return { error, user: null };
      
      // If successful, create user profile in the database
      if (data?.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            uuid: data.user.id,
            username,
            email,
            user_type_id: 2, // Assuming 2 is for regular users
          });
        
        if (profileError) {
          console.error('Error creating user profile:', profileError);
          return { error: profileError, user: null };
        }
      }
      
      return { error: null, user: data?.user ?? null };
    } catch (error) {
      return { error, user: null };
    }
  };

  // Sign out
  const signOut = async () => {
    if (DEV_MODE) {
      console.log('🔑 Development mode: Sign out ignored');
      return;
    }

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