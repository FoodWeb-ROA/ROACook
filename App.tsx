import './src/i18n'; // Initialize i18next
import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from './src/constants/theme';
import AppNavigator from './src/navigation/AppNavigator';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { AuthProvider } from './src/context/AuthContext';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { UnitSystemProvider } from './src/context/UnitSystemContext';
import { Provider } from 'react-redux';
import store from './src/store';
import { persistStore } from 'redux-persist';
import { DeepLinkHandler, useDeepLinking } from './src/hooks/useDeepLinking';
import { ReactQueryClientProvider } from './src/components/ReactQueryClientProvider';
import { PersistGate } from 'redux-persist/integration/react';
import { SupabaseRealtimeProvider } from './src/realtime/SupabaseRealtimeProvider';

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Create persistor instance here, using the imported store
const persistor = persistStore(store);

export default function App() {
	return (
		<Provider store={store}>
			<PersistGate loading={null} persistor={persistor}>
				<ReactQueryClientProvider>
					<SupabaseRealtimeProvider>
						<DeepLinkInterceptor />
					</SupabaseRealtimeProvider>
				</ReactQueryClientProvider>
			</PersistGate>
		</Provider>
	);
}

function DeepLinkInterceptor() {
	const [appIsReady, setAppIsReady] = useState(false);

	const handleDeepLink: DeepLinkHandler = (url, parsed) => {
		console.log('--- Received deep link in App:', url);
		console.log('--- Parsed deep link:', parsed);
	};

	useDeepLinking(handleDeepLink);

	useEffect(() => {
		async function prepare() {
			try {
				// Load fonts
				await Font.loadAsync({
					'Poppins': require('./assets/fonts/Poppins-Regular.ttf'),
					'Poppins-Light': require('./assets/fonts/Poppins-Light.ttf'),
					'Poppins-Medium': require('./assets/fonts/Poppins-Medium.ttf'),
					'Poppins-Bold': require('./assets/fonts/Poppins-Bold.ttf'),
				});
			} catch (e) {
				console.warn(e);
			} finally {
				// Tell the application to render
				setAppIsReady(true);
			}
		}

		prepare();
	}, []);

	const onLayoutRootView = useCallback(async () => {
		if (appIsReady) {
			// This tells the splash screen to hide immediately
			await SplashScreen.hideAsync();
		}
	}, [appIsReady]);

	if (!appIsReady) {
		return null;
	}

	return (
		<GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
			<SafeAreaProvider>
				<PaperProvider theme={theme}>
					<AuthProvider>
						<UnitSystemProvider>
							<ActionSheetProvider>
								<AppNavigator />
							</ActionSheetProvider>
						</UnitSystemProvider>
					</AuthProvider>
				</PaperProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
