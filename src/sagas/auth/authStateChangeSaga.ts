import { call, put } from 'redux-saga/effects';
import {
	authStateChanged,
	loginSuccess,
	registerSuccess,
	registerFailure,
	oauthSuccess,
	oauthFailure,
	logoutSuccess
} from '../../slices/authSlice';
import { checkExistingUser, insertPublicUser } from './userProfileSaga';
import { CheckUser, CreateUser } from './types';

export function* handleAuthStateChange(
	action: ReturnType<typeof authStateChanged>
): Generator<any, void, any> {
	const { session } = action.payload;

	console.log(
		`* handleAuthStateChange/session:`,
		session ? 'Session received' : 'Session is null'
	);

	if (session) {
		try {
			const { user } = session;

			console.log(`* handleAuthStateChange/user:`, JSON.stringify(user, null, 2));

			const checkExistingUserResponse: CheckUser = yield call(
				checkExistingUser,
				user.id
			);

			if (checkExistingUserResponse.data) {
				console.log(`* handleAuthStateChange: User exists in public table.`);

				if (user.app_metadata.provider === 'email') {
					const hasFullName =
						user.user_metadata?.full_name ||
						checkExistingUserResponse.data.user_fullname;

					if (hasFullName) {
						console.log(
							`* handleAuthStateChange: Email/password login or existing user.`
						);

						yield put(
							loginSuccess({
								session,
								user: checkExistingUserResponse.data
							})
						);
					} else {
						console.log(`* handleAuthStateChange: Email/password signup flow.`);

						yield put(
							registerSuccess({
								session,
								user: checkExistingUserResponse.data
							})
						);
					}
				} else {
					console.log(`* handleAuthStateChange: OAuth login or existing user.`);

					yield put(
						oauthSuccess({
							session,
							user: checkExistingUserResponse.data
						})
					);
				}
			} else if (checkExistingUserResponse.error?.code === 'PGRST116') {
				console.log(
					`* handleAuthStateChange: User not found in public table. Inserting...`
				);

				const fullname =
					user.user_metadata?.full_name || user.user_metadata?.name || 'New User';

				const language = user.user_metadata?.language || 'EN';

				const insertPublicUserResponse: CreateUser = yield call(
					insertPublicUser,
					user,
					fullname,
					language
				);

				if (insertPublicUserResponse.error || !insertPublicUserResponse.data) {
					console.error(
						'* handleAuthStateChange: User insertion failed:',
						insertPublicUserResponse.error?.message
					);

					if (user.app_metadata.provider === 'email') {
						yield put(
							registerFailure(
								insertPublicUserResponse.error?.message ||
									'Sign Up User Profile Creation Failed'
							)
						);
					} else {
						yield put(
							oauthFailure(
								insertPublicUserResponse.error?.message ||
									'OAuth User Profile Creation Failed'
							)
						);
					}

					return;
				}

				console.log(`* handleAuthStateChange: User inserted successfully.`);

				if (user.app_metadata.provider === 'email') {
					yield put(
						registerSuccess({ session, user: insertPublicUserResponse.data })
					);
				} else {
					yield put(oauthSuccess({ session, user: insertPublicUserResponse.data }));
				}
			} else {
				console.error(
					'* handleAuthStateChange: Error checking existing user:',
					checkExistingUserResponse.error
				);

				if (user.app_metadata.provider === 'email') {
					yield put(
						registerFailure(
							checkExistingUserResponse.error?.message ||
								'Database error checking user.'
						)
					);
				} else {
					yield put(
						oauthFailure(
							checkExistingUserResponse.error?.message ||
								'Database error checking user.'
						)
					);
				}
			}
		} catch (error: any) {
			console.error(
				'Error processing session update in handleAuthStateChange:',
				error
			);

			yield put(oauthFailure(error.message || 'Error processing session update.'));

			if (session.user.app_metadata.provider === 'email') {
				yield put(
					registerFailure(error.message || 'Error processing session update.')
				);
			} else {
				yield put(
					oauthFailure(error.message || 'Error processing session update.')
				);
			}
		}
	} else {
		console.log('* handleAuthStateChange: Session is null, user logged out.');

		yield put(logoutSuccess());
	}
}
