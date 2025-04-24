import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../data/database.types'; // Corrected path
 
export type TypedSupabaseClient = SupabaseClient<Database>; 