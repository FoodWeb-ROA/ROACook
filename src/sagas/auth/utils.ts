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

export const fetchUserProfile = async (authUser: User | null): Promise<(IUser & { kitchen_id: string }) | null> => {
	if (!authUser) {
		console.warn('fetchUserProfile called with null authUser');
		return null;
	}
	
	const userId = authUser.id; // Define userId here

	try {
		// Fetch the kitchen_id associated with the user
		const { data: kitchenUserData, error: kitchenUserError } = await supabase
			.from('kitchen_users')
			.select('kitchen_id') 
			.eq('user_id', userId)
			.limit(1)
			.single();

		if (kitchenUserError) {
			console.error('Error fetching kitchen_users data:', kitchenUserError);
			return null;
		}
		
		if (!kitchenUserData) {
			console.warn('No kitchen association found for user:', userId);
			return null;
		}

		// Combine auth user details with kitchen_id
		// Note: Adjust IUser type definition if necessary
		return {
			user_id: userId,
			user_fullname: authUser.user_metadata?.full_name || 'Unknown Name',
			user_language: authUser.user_metadata?.language || 'EN',
			user_email: authUser.email || null,
			kitchen_id: kitchenUserData.kitchen_id
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
