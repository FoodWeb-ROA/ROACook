import {
	Session,
	User,
	AuthError,
	PostgrestSingleResponse
} from '@supabase/supabase-js';
import { IUser } from '../../types';
import { SagaReturnType } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';

export type SignInResponse = SagaReturnType<
	typeof supabase.auth.signInWithPassword
>;
export type SignUpResponse = SagaReturnType<typeof supabase.auth.signUp>;
export type OAuthResponse = SagaReturnType<typeof supabase.auth.signInWithOAuth>;
export type SetSessionResponse = SagaReturnType<
	typeof supabase.auth.setSession
>;
export type CheckUser = SagaReturnType<() => PostgrestSingleResponse<IUser>>;
export type CreateUser = SagaReturnType<() => PostgrestSingleResponse<IUser>>;

export type AuthEventPayload = {
	session: Session | null;
};

export { AuthError, Session, User };
