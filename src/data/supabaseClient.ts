import 'react-native-url-polyfill';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from './database.types';
import { appLogger } from '../services/AppLogService';

// Define your Supabase URL and anon key
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl) {
  appLogger.error('Supabase URL is not defined. Please check your .env file.');
  throw new Error('Supabase URL is not defined.');
}
if (!supabaseAnonKey) {
  appLogger.error('Supabase anon key is not defined. Please check your .env file.');
  throw new Error('Supabase anon key is not defined.');
}

// Create and export the Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // Use AsyncStorage for session persistence
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
}); 