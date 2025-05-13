import { call, put } from 'redux-saga/effects';
import {
    authStateChanged,
    loginSuccess,
    registerSuccess,
    registerFailure,
    oauthSuccess,
    oauthFailure,
    logoutSuccess,
    loginFailure
} from '../../slices/authSlice';
import { checkExistingUser, checkKitchenUserLink, insertPublicUser, linkUserToKitchen } from './userProfileSaga';
import { CheckKitchenLink, CheckUser, CreateUser, LinkUserToDefaultKitchen } from './types';
import { setActiveKitchen } from '../../slices/kitchensSlice';

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

                const checkExistingKitchen: CheckKitchenLink = yield call(checkKitchenUserLink, user.id);

                if (checkExistingKitchen.error) {
                    console.error(
                        '* handleAuthStateChange: Error checking kitchen link:',
                        checkExistingKitchen.error
                    );
                    
                    if (user.app_metadata.provider === 'email') {
                        const hasFullName =
                            user.user_metadata?.full_name ||
                            checkExistingUserResponse.data.user_fullname;

                        if (hasFullName) {
                            console.log(
                                `* handleAuthStateChange: Email/password login or existing user with kitchen.`
                            );
                            yield put(
                                loginFailure(checkExistingKitchen.error?.message)
                            );
                        } else {
                            console.log(
                                `* handleAuthStateChange: Email/password signup flow for existing user with kitchen.`
                            );
                            yield put(
                                registerFailure(checkExistingKitchen.error?.message)
                            );
                        }
                    } else {
                        console.log(
                            `* handleAuthStateChange: OAuth login or existing user with kitchen.`
                        );
                        yield put(
                            oauthFailure(checkExistingKitchen.error?.message)
                        );
                    }

                } else if (checkExistingKitchen.data?.length > 0) {
                    const activeKitchenId = checkExistingKitchen.data[0].kitchen_id;
                    yield put(setActiveKitchen(activeKitchenId));

                    if (user.app_metadata.provider === 'email') {
                        const hasFullName =
                            user.user_metadata?.full_name ||
                            checkExistingUserResponse.data.user_fullname;

                        if (hasFullName) {
                            console.log(
                                `* handleAuthStateChange: Email/password login or existing user with kitchen.`
                            );
                            yield put(
                                loginSuccess({
                                    session,
                                    user: checkExistingUserResponse.data
                                })
                            );
                        } else {
                            console.log(
                                `* handleAuthStateChange: Email/password signup flow for existing user with kitchen.`
                            );
                            yield put(
                                registerSuccess({
                                    session,
                                    user: checkExistingUserResponse.data
                                })
                            );
                        }
                    } else {
                        console.log(
                            `* handleAuthStateChange: OAuth login or existing user with kitchen.`
                        );
                        yield put(
                            oauthSuccess({
                                session,
                                user: checkExistingUserResponse.data
                            })
                        );
                    }
                } else {
                    const linkResponse: LinkUserToDefaultKitchen = yield call(linkUserToKitchen, user.id);

                    if (linkResponse.error || !linkResponse.data) {
                        console.error(
                            '* handleAuthStateChange: Failed to link existing user to kitchen:',
                            linkResponse.error?.message
                        );

                    } else {
                        const activeKitchenId = linkResponse.data.kitchen_id;
                        yield put(setActiveKitchen(activeKitchenId));

                        if (user.app_metadata.provider === 'email') {
                            const hasFullName =
                                user.user_metadata?.full_name ||
                                checkExistingUserResponse.data.user_fullname;

                            if (hasFullName) {
                                console.log(
                                    `* handleAuthStateChange: Email/password login for existing user (linked to default).`
                                );
                                yield put(
                                    loginSuccess({
                                        session,
                                        user: checkExistingUserResponse.data
                                    })
                                );
                            } else {
                                console.log(
                                    `* handleAuthStateChange: Email/password signup flow for existing user (linked to default).`
                                );
                                yield put(
                                    registerSuccess({
                                        session,
                                        user: checkExistingUserResponse.data
                                    })
                                );
                            }
                        } else {
                            console.log(
                                `* handleAuthStateChange: OAuth login for existing user (linked to default).`
                            );
                            yield put(
                                oauthSuccess({
                                    session,
                                    user: checkExistingUserResponse.data
                                })
                            );
                        }
                    }
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

                console.log(`* handleAuthStateChange: User inserted successfully. Linking to default kitchen...`);

                const linkedUserToKitchen: LinkUserToDefaultKitchen = yield call(linkUserToKitchen, user.id);

                if (linkedUserToKitchen.error || !linkedUserToKitchen.data) {
                    console.error(
                        '* handleAuthStateChange: Failed to link new user to kitchen:',
                        linkedUserToKitchen.error?.message
                    );
                    
                    if (user.app_metadata.provider === 'email') {
                        yield put(
                            registerFailure(
                                linkedUserToKitchen.error?.message ||
                                    'Failed to link new user to kitchen'
                            )
                        );
                    } else {
                        yield put(
                            oauthFailure(
                                linkedUserToKitchen.error?.message ||
                                    'Failed to link new user to kitchen'
                            )
                        );
                    }

                    return;
                } else {
                    const activeKitchenId = linkedUserToKitchen.data.kitchen_id;
                    yield put(setActiveKitchen(activeKitchenId));

                    if (user.app_metadata.provider === 'email') {
                        yield put(
                            registerSuccess({ session, user: insertPublicUserResponse.data })
                        );
                    } else {
                        yield put(oauthSuccess({ session, user: insertPublicUserResponse.data }));
                    }
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

            if (session?.user?.app_metadata?.provider === 'email') {
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