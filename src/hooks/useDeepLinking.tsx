import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import * as LinkingExpo from 'expo-linking';
import { useTypedDispatch } from './useTypedDispatch';
import { oauthCallback } from '../slices/authSlice';

export type DeepLinkHandler = (
	url: string,
	parsed: ReturnType<typeof LinkingExpo.parse>
) => void;

export function useDeepLinking(onDeepLink: DeepLinkHandler) {
	const typedDispatch = useTypedDispatch();

	useEffect(() => {
		console.log(`--- deep linking connected`);

		const handleDeepLink = (event: { url: string }) => {
			const { url } = event;

			console.log('--- useDeepLinking/Deep link received:', url);

			const parsed = LinkingExpo.parse(url);

			console.log('--- useDeepLinking/parsed URL:', parsed);

			if (onDeepLink) {
				onDeepLink(url, parsed);
			}

			if (parsed?.path === 'callback') {
                typedDispatch(oauthCallback({ url }));
            }
		};

		const subscription = Linking.addEventListener('url', handleDeepLink);

		Linking.getInitialURL().then(url => {
			if (url) {
				console.log(
					'--- useDeepLinking/getInitialURL/app opened from deep link:',
					url
				);

				const parsed = LinkingExpo.parse(url);

				if (onDeepLink) {
					onDeepLink(url, parsed);
				}
			}
		});

		return () => {
			subscription.remove();
		};
	}, [onDeepLink]);
}

