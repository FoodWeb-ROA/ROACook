import { call, SagaReturnType } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import { User, CheckUser, CreateUser } from './types';
import { ILanguage, IUser } from '../../types';
import { PostgrestSingleResponse } from '@supabase/supabase-js';

export function* checkExistingUser(
	userId: string
): Generator<any, CheckUser, any> {
	console.log(`* checkExistingUser: Checking user with ID: ${userId}`);

	const checkResponse: CheckUser = yield call(() =>
		supabase.from('users').select('*').eq('user_id', userId).single()
	);

	console.log(`* checkExistingUser/checkResponse:`, checkResponse);

	return checkResponse;
}

export function* insertPublicUser(
	user: User,
	fullname: string,
	language: ILanguage['ISO_Code']
): Generator<any, CreateUser, any> {
	console.log(`* insertPublicUser: Inserting user for ${user.email}`);

	const insertResponse: CreateUser = yield call(() =>
		supabase
			.from('users')
			.insert<IUser>({
				user_id: user.id,
				user_fullname: fullname,
				user_language: language,
				user_email: user.email!
			})
			.select('*')
			.single()
	);

	console.log(`* insertPublicUser/insertResponse:`, insertResponse);

	return insertResponse;
}

export type LinkUserToDefaultKitchen = SagaReturnType<() => PostgrestSingleResponse<{ kitchen_id: string } | null>>;

export function* linkUserToKitchen(
    userId: string
): Generator<any, LinkUserToDefaultKitchen, any> {
    const defaultKitchenId = process.env.EXPO_PUBLIC_DEFAULT_KITCHEN_ID;

    if (!defaultKitchenId) {
        const errMsg = 'EXPO_PUBLIC_DEFAULT_KITCHEN_ID is not set. Cannot link user to a kitchen.';
        console.error(`* linkUserToKitchen: ${errMsg}`);
        return { data: null, error: new Error(errMsg) } as LinkUserToDefaultKitchen;
    }

    console.log(`* linkUserToKitchen: Linking user ${userId} to kitchen ${defaultKitchenId}`);

    const insertResponse: LinkUserToDefaultKitchen = yield call(() =>
        supabase
            .from('kitchen_users')
            .insert<{ user_id: string; kitchen_id: string }>({
                user_id: userId,
                kitchen_id: defaultKitchenId
            })
            .select('kitchen_id')
            .maybeSingle()
    );

    console.log(`* linkUserToKitchen/insertResponse:`, insertResponse);

    return insertResponse;
}

export type CheckKitchenLink = SagaReturnType<() => PostgrestSingleResponse<{ kitchen_id: string }[]>>;

export function* checkKitchenUserLink(
    userId: string
): Generator<any, CheckKitchenLink, any> {
    console.log(`* checkKitchenUserLink: Checking kitchen link for user ID: ${userId}`);

    const checkResponse: CheckKitchenLink = yield call(() =>
        supabase
            .from('kitchen_users')
            .select('kitchen_id')
            .eq('user_id', userId)
    );

    console.log(`* checkKitchenUserLink/checkResponse:`, checkResponse);

    return checkResponse;
}