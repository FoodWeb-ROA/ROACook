import { EventChannel, eventChannel } from 'redux-saga';
import { supabase } from '../../data/supabaseClient';
import { AuthEventPayload } from './types';
import { IUser } from '../../types';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { User } from '@supabase/supabase-js';

export function createAuthChannel(): EventChannel<AuthEventPayload> {
	return eventChannel(emitter => {
		console.log('--- createAuthChannel: Setting up auth state listener');

		const { data: listener } = supabase.auth.onAuthStateChange(
			(event: AuthChangeEvent, session: Session | null) => {
				console.log(`Supabase auth event: ${event}`);
				emitter({ session });
			}
		);

		return () => {
			console.log('--- createAuthChannel: Unsubscribing from auth state listener');

			listener.subscription.unsubscribe();
		};
	});
}

export async function testConnection() {
	console.log("*** Testing Supabase connection by querying 'kitchen' table...");
	const { data, error } = await supabase.from('kitchen').select('*').limit(1);

	if (error) {
		console.error('*** supabase connection/error:', error.message);
	} else {
		console.log('*** supabase connection/data (from kitchen):', data);
	}
}

export const parseUrlFragment = (url: string): Record<string, string> => {
	const fragment = url.split('#')[1];

	if (!fragment) {
		return {};
	}

	return fragment.split('&').reduce((acc: Record<string, string>, item) => {
		const [key, value] = item.split('=');

		if (key && value !== undefined) {
			acc[key] = decodeURIComponent(value);
		}

		return acc;
	}, {});
};

/**
 * Fetches combined user profile information.
 * Gets username from public.profiles and kitchen_id from public.kitchen_users.
 * Uses basic info (id, email) from the authenticated auth.users object.
 */
export const fetchUserProfile = async (authUser: User | null): Promise<(IUser & { kitchen_id: string }) | null> => {
	if (!authUser) {
		console.warn('fetchUserProfile called with null authUser');
		return null;
	}
	
	const userId = authUser.id;

	try {
		// Fetch profile data (e.g., username)
		const { data: profileData, error: profileError } = await supabase
			.from('profiles') // Query the new profiles table
			.select('username') 
			.eq('id', userId)
			.maybeSingle(); // Use maybeSingle as profile might not exist immediately after signup trigger

		if (profileError) {
			console.error('Error fetching profile data:', profileError);
			// Don't return null immediately, maybe kitchen link still exists
		}

		// Fetch the kitchen_id associated with the user
		const { data: kitchenUserData, error: kitchenUserError } = await supabase
			.from('kitchen_users')
			.select('kitchen_id') 
			.eq('user_id', userId)
			.limit(1) // Assuming user belongs to max 1 kitchen initially?
			.single(); // Use single if user MUST be linked to proceed

		if (kitchenUserError) {
			console.error('Error fetching kitchen_users data:', kitchenUserError);
			// If kitchen link is mandatory for a valid profile, return null
			return null; 
		}
		
		if (!kitchenUserData) {
			// This case might be redundant if .single() throws error, but good practice
			console.warn('No kitchen association found for user:', userId);
			return null;
		}

		// Combine auth user details, profile username, and kitchen_id
		// Fallback for username if profile doesn't exist or fetch failed
		const username = profileData?.username || authUser.user_metadata?.username || 'User';

		return {
			user_id: userId,
			user_fullname: username, // Use username from profiles table
			user_language: 'EN', // Default or fetch from profile if added later
			user_email: authUser.email || null,
			kitchen_id: kitchenUserData.kitchen_id // Include kitchen_id as per original type
		};
		
	} catch (err) {
		console.error('Unexpected error in fetchUserProfile:', err);
		return null;
	}
};

// This function is commented out as it relies on the removed 'users' table 
// and fetching all users might not be desired or secure.
/*
export const fetchAllUsers = async (): Promise<IUser[]> => {
	console.warn("fetchAllUsers function called but is commented out due to schema changes.");
	return []; 
}; 
*/
