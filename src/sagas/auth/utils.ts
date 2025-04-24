import { EventChannel, eventChannel } from 'redux-saga';
import { supabase } from '../../data/supabaseClient';
import { AuthEventPayload } from './types';

export function createAuthChannel(): EventChannel<AuthEventPayload> {
	return eventChannel(emit => {
		console.log('--- createAuthChannel: Setting up auth state listener');

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event, session) => {
			console.log('--- onAuthStateChange event received:', event);

			emit({ session });
		});

		return () => {
			console.log('--- createAuthChannel: Unsubscribing from auth state listener');

			subscription?.unsubscribe();
		};
	});
}

export async function testConnection() {
	const { data, error } = await supabase.from('users').select('*');

	if (error) {
		console.error('*** supabase connection/error:', error.message);
	} else {
		console.log('*** supabase connection/data:', data);
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
