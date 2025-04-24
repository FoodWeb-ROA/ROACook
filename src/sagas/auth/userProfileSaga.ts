import { call } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import { User } from '@supabase/supabase-js';
import { CheckUser, CreateUser } from './types';
import { ILanguage, IUser } from '../../types';

export function* checkKitchenUserLink(
	userId: string
): Generator<any, { data: { kitchen_id: string } | null; error: any }, any> {
	console.log(`* checkKitchenUserLink: Checking kitchen link for user ID: ${userId}`);

	type KitchenUserResponse = { data: { kitchen_id: string } | null; error: any };

	const checkResponse: KitchenUserResponse = yield call(() =>
		supabase
			.from('kitchen_users')
			.select('kitchen_id')
			.eq('user_id', userId)
			.maybeSingle()
	);

	console.log(`* checkKitchenUserLink/checkResponse:`, checkResponse);

	return checkResponse;
}

export function* linkUserToKitchen(
	user: User
): Generator<any, { data: any; error: any }, any> {
	const userId = user.id;
	const defaultKitchenId = process.env.EXPO_PUBLIC_DEFAULT_KITCHEN_ID;

	if (!defaultKitchenId) {
		const errMsg = 'EXPO_PUBLIC_DEFAULT_KITCHEN_ID is not set. Cannot link user to a kitchen.';
		console.error(`* linkUserToKitchen: ${errMsg}`);
		return { data: null, error: new Error(errMsg) };
	}

	console.log(`* linkUserToKitchen: Linking user ${userId} to kitchen ${defaultKitchenId}`);

	// Define the shape of the data to insert into kitchen_users
	type KitchenUserInsert = {
		user_id: string;
		kitchen_id: string;
	};

	const insertResponse: { data: any; error: any } = yield call(() =>
		supabase
			.from('kitchen_users')
			.insert<KitchenUserInsert>({
				user_id: userId,
				kitchen_id: defaultKitchenId
			})
			.select() // Select the inserted row (or handle potential errors)
			.maybeSingle() // Use maybeSingle in case insert fails or returns nothing
	);

	console.log(`* linkUserToKitchen/insertResponse:`, insertResponse);

	// Handle potential insertion errors
	if (insertResponse.error) {
		console.error(`* linkUserToKitchen: Error inserting link:`, insertResponse.error);
	}

	// We might not need to return the inserted data itself, 
	// but the kitchen_id is important for subsequent steps.
	// Return the kitchen_id if successful, otherwise propagate the error.
	return {
		data: insertResponse.error ? null : { kitchen_id: defaultKitchenId },
		error: insertResponse.error
	};
}
