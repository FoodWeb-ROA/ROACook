import { call, SagaReturnType } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import { User, CheckUser, CreateUser } from './types';
import { ILanguage, IUser } from '../../types';
import { PostgrestSingleResponse } from '@supabase/supabase-js';
import { appLogger } from '../../services/AppLogService';

export function* checkExistingUser(
	userId: string
): Generator<any, CheckUser, any> {
	appLogger.log(`* checkExistingUser: Checking user with ID: ${userId}`);

	const checkResponse: CheckUser = yield call(() =>
		supabase.from('users').select('*').eq('user_id', userId).single()
	);

	appLogger.log(`* checkExistingUser/checkResponse:`, checkResponse);

	return checkResponse;
}

export function* insertPublicUser(
	user: User,
	fullname: string,
	language: ILanguage['ISO_Code']
): Generator<any, CreateUser, any> {
	appLogger.log(`* insertPublicUser: Inserting user for ${user.email}`);

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

	appLogger.log(`* insertPublicUser/insertResponse:`, insertResponse);

	return insertResponse;
}

export type LinkUserToDefaultKitchen = SagaReturnType<() => PostgrestSingleResponse<{ kitchen_id: string } | null>>;

export function* linkUserToKitchen(
    userId: string
): Generator<any, LinkUserToDefaultKitchen, any> {
    const defaultKitchenId = process.env.EXPO_PUBLIC_DEFAULT_KITCHEN_ID;

    if (!defaultKitchenId) {
        const errMsg = 'EXPO_PUBLIC_DEFAULT_KITCHEN_ID is not set. Cannot link user to a kitchen.';
        appLogger.error(`* linkUserToKitchen: ${errMsg}`);
        return { data: null, error: new Error(errMsg) } as LinkUserToDefaultKitchen;
    }

    appLogger.log(`* linkUserToKitchen: Linking user ${userId} to kitchen ${defaultKitchenId}`);

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

    appLogger.log(`* linkUserToKitchen/insertResponse:`, insertResponse);

    return insertResponse;
}

export type CheckKitchenLink = SagaReturnType<() => PostgrestSingleResponse<{ kitchen_id: string }[]>>;

export function* checkKitchenUserLink(
    userId: string
): Generator<any, CheckKitchenLink, any> {
    appLogger.log(`* checkKitchenUserLink: Checking kitchen link for user ID: ${userId}`);

    const checkResponse: CheckKitchenLink = yield call(() =>
        supabase
            .from('kitchen_users')
            .select('kitchen_id')
            .eq('user_id', userId)
    );

    appLogger.log(`* checkKitchenUserLink/checkResponse:`, checkResponse);

    return checkResponse;
}