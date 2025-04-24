import { call, put } from 'redux-saga/effects';
import {
	authStateChanged,
	loginSuccess,
	loginFailure,
	registerSuccess,
	registerFailure,
	oauthSuccess,
	oauthFailure,
	logoutSuccess
} from '../../slices/authSlice';
import { checkKitchenUserLink, linkUserToKitchen } from './userProfileSaga';
import { fetchUserProfile } from './utils';
import { CheckUser, CreateUser } from './types';
import { IUser } from '../../types';

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

			if (!user) {
				console.error('* handleAuthStateChange: Session exists but user object is null.');
				yield put(logoutSuccess());
				return;
			}

			console.log(`* handleAuthStateChange/user:`, JSON.stringify(user, null, 2));

			const kitchenLinkResponse: { data: { kitchen_id: string } | null; error: any } = yield call(
				checkKitchenUserLink,
				user.id
			);

			if (kitchenLinkResponse.error) {
				console.error(
					'* handleAuthStateChange: Error checking kitchen link:',
					kitchenLinkResponse.error
				);
				const errorMsg = kitchenLinkResponse.error.message || 'Database error checking user kitchen link.';
				if (user.app_metadata.provider === 'email') {
					yield put(registerFailure(errorMsg));
				} else {
					yield put(oauthFailure(errorMsg));
				}
				return;
			}

			if (kitchenLinkResponse.data) {
				console.log(`* handleAuthStateChange: User ${user.id} is linked to kitchen ${kitchenLinkResponse.data.kitchen_id}.`);
				
				const userProfile: (IUser & { kitchen_id: string }) | null = yield call(fetchUserProfile, user);

				if (!userProfile) {
					console.error('* handleAuthStateChange: Failed to fetch combined user profile after confirming kitchen link.');
					const errorMsg = 'Failed to retrieve full user profile.';
					if (user.app_metadata.provider === 'email') yield put(loginFailure(errorMsg));
					else yield put(oauthFailure(errorMsg));
					return;
				}

				if (user.app_metadata.provider === 'email') {
					console.log('* handleAuthStateChange: Email provider - dispatching loginSuccess.');
					yield put(loginSuccess({ session, user: userProfile }));
				} else {
					console.log('* handleAuthStateChange: OAuth provider - dispatching oauthSuccess.');
					yield put(oauthSuccess({ session, user: userProfile }));
				}
			} else {
				console.log(
					`* handleAuthStateChange: User ${user.id} not linked to a kitchen. Attempting to link...`
				);

				const linkResponse: { data: { kitchen_id: string } | null; error: any } = yield call(
					linkUserToKitchen,
					user
				);

				if (linkResponse.error || !linkResponse.data) {
					console.error(
						'* handleAuthStateChange: Failed to link user to kitchen:',
						linkResponse.error?.message
					);
					const errorMsg = linkResponse.error?.message || 'Failed to link user to a kitchen.';
					if (user.app_metadata.provider === 'email') {
						yield put(registerFailure(errorMsg));
					} else {
						yield put(oauthFailure(errorMsg));
					}
					return;
				}

				console.log(`* handleAuthStateChange: User linked successfully to kitchen ${linkResponse.data.kitchen_id}.`);
				
				const userProfile: (IUser & { kitchen_id: string }) | null = yield call(fetchUserProfile, user);

				if (!userProfile) {
					console.error('* handleAuthStateChange: Failed to fetch combined user profile after linking to kitchen.');
					const errorMsg = 'Failed to retrieve full user profile after linking.';
					if (user.app_metadata.provider === 'email') yield put(registerFailure(errorMsg));
					else yield put(oauthFailure(errorMsg));
					return;
				}

				if (user.app_metadata.provider === 'email') {
					yield put(registerSuccess({ session, user: userProfile }));
				} else {
					yield put(oauthSuccess({ session, user: userProfile }));
				}
			}
		} catch (error: any) {
			console.error(
				'Error processing session update in handleAuthStateChange:',
				error
			);
			const errorMsg = error.message || 'Error processing session update.';
			yield put(oauthFailure(errorMsg));
		}
	} else {
		console.log('* handleAuthStateChange: Session is null, user logged out.');
		yield put(logoutSuccess());
	}
}
