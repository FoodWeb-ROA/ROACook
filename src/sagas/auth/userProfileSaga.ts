import { call } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import { User, CheckUser, CreateUser } from './types';
import { ILanguage, IUser } from '../../types';

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
