import { EventChannel, eventChannel } from 'redux-saga';
import { supabase } from '../../data/supabaseClient';
import { appLogger } from '../../services/AppLogService';
import { AuthEventPayload } from './types';
import { IUser } from '../../types';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { User } from '@supabase/supabase-js';

export function createAuthChannel(): EventChannel<AuthEventPayload> {
	return eventChannel(emitter => {
		appLogger.log('--- createAuthChannel: Setting up auth state listener');

		const { data: listener } = supabase.auth.onAuthStateChange(
			(event: AuthChangeEvent, session: Session | null) => {
				appLogger.log(`Supabase auth event: ${event}`);
				emitter({ session });
			}
		);

		return () => {
			appLogger.log('--- createAuthChannel: Unsubscribing from auth state listener');

			listener.subscription.unsubscribe();
		};
	});
}

export async function testConnection() {
	appLogger.log("*** Testing Supabase connection by querying 'kitchen' table...");
	const { data, error } = await supabase.from('kitchen').select('*').limit(1);

	if (error) {
		appLogger.error('*** supabase connection/error:', error.message);
	} else {
		appLogger.log('*** supabase connection/data (from kitchen):', data);
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

