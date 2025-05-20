import { supabase } from '../data/supabaseClient';
import { Kitchen } from '../types';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { TypedSupabaseClient } from '../utils/types'; // Assuming this type exists or will be created
import { SupabaseClient } from '@supabase/supabase-js';
import { appLogger } from '../services/AppLogService';

// Define a type for the client, accommodating potential differences if needed
type Client = TypedSupabaseClient | SupabaseClient<any, "public", any>;

/**
 * Query function to fetch kitchens for a given user ID.
 * Uses supabase-cache-helpers structure for automatic key generation.
 */
export const getKitchensForUserQuery = (client: Client, userId: string) => {
  return client
    .from('kitchen_users')
    .select(`
      kitchen:kitchen_id (
        kitchen_id,
        name
      )
    `)
    .eq('user_id', userId)
    .throwOnError(); // Throw error for React Query to catch
};

/**
 * Utility to extract Kitchen[] from the query data structure.
 */
export const transformKitchensData = (data: any[] | null): Kitchen[] => {
  if (!data) return [];
  return data.map((item: any) => ({
    kitchen_id: item.kitchen.kitchen_id,
    name: item.kitchen.name,
  }));
}; 