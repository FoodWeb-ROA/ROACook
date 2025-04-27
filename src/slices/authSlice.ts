import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Session } from '@supabase/supabase-js';
import { ILanguage, IUser } from '../types';

interface AuthState {
	session: Session | null;
	user: IUser | null;
	loading: boolean;
	error: string | null;
}

const initialState: AuthState = {
	session: null,
	user: null,
	loading: false,
	error: null
};

export interface LoginPayload {
	email: string;
	password: string;
}

export interface RegisterPayload {
	email: string;
	password: string;
	fullname: string;
	language: ILanguage['ISO_Code'];
}

const authSlice = createSlice({
	name: 'auth',
	initialState,
	reducers: {
		loginWatch(state, action: PayloadAction<LoginPayload>) {
			state.loading = true;
			state.error = null;
		},
		loginSuccess(
			state,
			action: PayloadAction<{ session: Session; user: IUser }>
		) {
			state.loading = false;
			state.error = null;
			state.session = action.payload.session;
			state.user = action.payload.user;
		},
		loginFailure(state, action: PayloadAction<string>) {
			state.loading = false;
			state.error = action.payload;
			state.session = null;
			state.user = null;
		},
		registerWatch(state, action: PayloadAction<RegisterPayload>) {
			state.loading = true;
			state.error = null;
		},
		registerSuccess(
			state,
			action: PayloadAction<{
				session: Session;
				user: IUser;
			}>
		) {
			state.loading = false;
			state.error = null;
			state.session = action.payload.session;
			state.user = action.payload.user;
		},
		registerFailure(state, action: PayloadAction<string>) {
			state.loading = false;
			state.error = action.payload;
			state.session = null;
			state.user = null;
		},
		logoutWatch(state) {
			state.loading = true;
			state.error = null;
		},
		logoutSuccess(state) {
			console.log('--- logoutSuccess reducer: Setting loading=false');
			state.loading = false;
			state.session = null;
			state.user = null;
			state.error = null;
		},
		logoutFailure(state, action: PayloadAction<string>) {
			state.loading = false;
			state.error = action.payload;
			state.session = null;
			state.user = null;
		},
		authStateChanged(
			state,
			action: PayloadAction<{
				session: Session | null;
			}>
		) {
			state.session = action.payload.session;
		},
		oauthWatch(
			state,
			action: PayloadAction<{ provider: 'apple' | 'azure' | 'google' }>
		) {
			state.loading = true;
			state.error = null;
		},
		oauthCallback(state, action: PayloadAction<{ url: string }>) {},
		oauthSuccess(
			state,
			action: PayloadAction<{ session: Session; user: IUser }>
		) {
			state.loading = false;
			state.error = null;
			state.session = action.payload.session;
			state.user = action.payload.user;
		},
		oauthFailure(state, action: PayloadAction<string>) {
			state.loading = false;
			state.error = action.payload;
			state.session = null;
			state.user = null;
		}
	}
});

export const {
	loginWatch,
	loginSuccess,
	loginFailure,
	registerWatch,
	registerSuccess,
	registerFailure,
	logoutWatch,
	logoutSuccess,
	logoutFailure,
	authStateChanged,
	oauthWatch,
	oauthSuccess,
	oauthFailure,
	oauthCallback
} = authSlice.actions;

export const authReducer = authSlice.reducer;
