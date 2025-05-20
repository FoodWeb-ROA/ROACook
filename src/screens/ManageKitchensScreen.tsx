import React, { useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import AppHeader from '../components/AppHeader';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { useDispatch } from 'react-redux';
import { useTypedSelector } from '../hooks/useTypedSelector';
import { leaveKitchenWatch, setActiveKitchen } from '../slices/kitchensSlice';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Kitchen, IUser } from '../types';
import { useQuery } from '@supabase-cache-helpers/postgrest-react-query';
import { supabase } from '../data/supabaseClient';
import { getKitchensForUserQuery, transformKitchensData } from '../queries/kitchenQueries';
import { QueryClient } from '@tanstack/react-query';
import { appLogger } from '../services/AppLogService';

// Define navigation prop type
type ManageKitchensScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ManageKitchens'>;

// Define the expected data structure from getKitchensForUserQuery
type KitchensQueryData = {
  kitchen: {
    kitchen_id: string;
    name: string;
  };
}[] | null;

const ManageKitchensScreen = () => {
  const navigation = useNavigation<ManageKitchensScreenNavigationProp>();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  
  // Get activeKitchenId and potentially user from Redux
  const { activeKitchenId } = useTypedSelector(state => state.kitchens);
  const user: IUser | null = useTypedSelector(state => state.auth.user);
  const queryClient = (window as any).queryClient as QueryClient;
  
  // Fetch kitchens using React Query (revert explicit types on hook)
  const { 
    data: rawKitchenData, // Type is likely inferred as unknown or specific helper type
    isLoading, 
    error: queryError, 
    refetch 
  } = useQuery(
    getKitchensForUserQuery(supabase, user?.user_id || ''),
    {
      enabled: !!user?.user_id,
    }
  );

  // Transform data, casting the input type
  const kitchens = transformKitchensData(rawKitchenData as KitchensQueryData);
  // Handle potential error structure (might be PostgrestError or generic Error)
  const error = queryError ? (queryError as any).message || 'An error occurred' : null;
  
  // Handle kitchen selection
  const handleSelectKitchen = (kitchenId: string) => {
    dispatch(setActiveKitchen(kitchenId));
    Alert.alert(
      t('screens.manageKitchens.switchKitchenTitle'),
      t('screens.manageKitchens.switchKitchenMessage'),
      [
        { 
          text: t('common.ok'), 
          onPress: () => {
            appLogger.log('Switched to kitchen:', kitchenId);
            // You might want to reset the app state or redirect to home here
            navigation.goBack();
          }
        }
      ]
    );
  };
  
  // Handle leave kitchen
  const handleLeaveKitchen = (kitchenId: string, kitchenName: string) => {
    Alert.alert(
      t('screens.manageKitchens.leaveKitchenTitle'),
      t('screens.manageKitchens.leaveKitchenMessage', { name: kitchenName }),
      [
        { 
          text: t('common.cancel'), 
          style: 'cancel' 
        },
        { 
          text: t('screens.manageKitchens.leaveButton'), 
          onPress: () => {
            dispatch(leaveKitchenWatch(kitchenId));
            if (user?.user_id) {
              queryClient.invalidateQueries({ 
                queryKey: ['kitchen_users', `user_id=eq.${user.user_id}`] 
              });
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  // Render kitchen item
  const renderKitchenItem = (kitchen: Kitchen) => {
    const isActive = kitchen.kitchen_id === activeKitchenId;
    
    return (
      <View key={kitchen.kitchen_id} style={styles.kitchenItem}>
        <TouchableOpacity 
          style={[styles.kitchenInfo, isActive && styles.activeKitchen]}
          onPress={() => handleSelectKitchen(kitchen.kitchen_id)}
        >
          <MaterialCommunityIcons 
            name={isActive ? "check-circle" : "circle-outline"} 
            size={24} 
            color={isActive ? COLORS.primary : COLORS.textLight} 
          />
          <View style={styles.kitchenDetails}>
            <Text style={styles.kitchenName}>{kitchen.name}</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.leaveButton}
          onPress={() => handleLeaveKitchen(kitchen.kitchen_id, kitchen.name)}
        >
          <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <AppHeader
        title={t('navigation.manageKitchens')}
        showBackButton={true}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {isLoading && (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        )}
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => refetch()}
            >
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {!isLoading && !error && (
          <>
            {kitchens.length === 0 ? (
              <Text style={styles.noKitchensText}>{t('screens.manageKitchens.noKitchens')}</Text>
            ) : (
              <View style={styles.kitchenList}>
                {kitchens.map(renderKitchenItem)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: SIZES.padding * 2,
  },
  loader: {
    marginVertical: SIZES.padding * 2,
  },
  errorContainer: {
    alignItems: 'center',
    marginVertical: SIZES.padding * 2,
  },
  errorText: {
    ...FONTS.body2,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SIZES.padding,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
  },
  retryButtonText: {
    fontFamily: 'Poppins',
    fontSize: SIZES.font,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  noKitchensText: {
    ...FONTS.body1,
    color: COLORS.textLight,
    textAlign: 'center',
    marginVertical: SIZES.padding * 2,
  },
  kitchenList: {
    marginTop: SIZES.padding,
  },
  kitchenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.padding,
    overflow: 'hidden',
  },
  kitchenInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.padding * 1.5,
  },
  activeKitchen: {
    backgroundColor: COLORS.primary + '20', // 20% opacity primary color
  },
  kitchenDetails: {
    marginLeft: SIZES.padding,
  },
  kitchenName: {
    ...FONTS.h4,
    color: COLORS.text,
  },
  leaveButton: {
    paddingHorizontal: SIZES.padding * 1.5,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.error + '10', // 10% opacity error color
  },
});

export default ManageKitchensScreen; 