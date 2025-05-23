import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { Dish, DishComponent } from '../types';
import AppHeader from '../components/AppHeader';
import PreparationCard from '../components/PreparationCard';
import { useDishDetail, useCurrentKitchenId } from '../hooks/useSupabase';
import { formatQuantityAuto } from '../utils/textFormatters';
import ScaleSliderInput from '../components/ScaleSliderInput';
import { useTranslation } from 'react-i18next';
import { transformDishComponent } from '../utils/transforms';
import UpdateNotificationBanner from '../components/UpdateNotificationBanner';
import { supabase } from '../data/supabaseClient';
import { useTypedSelector } from '../hooks/useTypedSelector';
import { queryClient } from '../data/queryClient';
import { appLogger } from '../services/AppLogService';

type DishDetailRouteProp = RouteProp<RootStackParamList, 'DishDetails'>;
type DishDetailNavigationProp = StackNavigationProp<RootStackParamList>;

const DishDetailScreen = () => {
  const navigation = useNavigation<DishDetailNavigationProp>();
  const route = useRoute<DishDetailRouteProp>();
  const { dishId } = route.params;
  const { t } = useTranslation();

  const kitchenId = useTypedSelector(state => state.kitchens.activeKitchenId);
  const [isKitchenIdLoading, setIsKitchenIdLoading] = useState(true);

  useEffect(() => {
    if (kitchenId !== undefined) {
      setIsKitchenIdLoading(false);
    }
  }, [kitchenId]);

  const {
    dish,
    loading: dishLoading,
    error,
    lastUpdateTime
  } = useDishDetail(dishId, kitchenId);

  const [originalServings, setOriginalServings] = useState(1);
  const [targetServings, setTargetServings] = useState(1);
  const servingScale = useMemo(() => (
    originalServings > 0 ? targetServings / originalServings : 1
  ), [targetServings, originalServings]);

  // Separate components into preparations ingredients
  const preparationComponents = useMemo(() =>
    dish?.components?.filter(c => c.isPreparation) || [],
    [dish?.components]
  );
  const RawIngredients = useMemo(() =>
    dish?.components?.filter(c => !c.isPreparation) || [],
    [dish?.components]
  );

  // Effect to initialize servings state when dish data loads
  useEffect(() => {
    if (dish?.num_servings) {
      const initialServings = dish.num_servings > 0 ? dish.num_servings : 1;
      setOriginalServings(initialServings);
      setTargetServings(initialServings);
    }
  }, [dish?.num_servings]);

  // Effect to show banner on update
  const [showBanner, setShowBanner] = useState(false);
  const lastUpdateTimeRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (lastUpdateTime && lastUpdateTime !== lastUpdateTimeRef.current) {
      setShowBanner(true);
      lastUpdateTimeRef.current = lastUpdateTime;
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastUpdateTime]);

  // Navigation handler for preparation press
  const handlePreparationPress = (preparationId: string, component: DishComponent) => {
    if (!preparationId) {
      appLogger.warn('Attempted to navigate to preparation with invalid ID');
      return;
    }
    // Pass the actual amount of the prep used in the dish
    navigation.navigate('PreparationDetails', {
      preparationId,
      recipeServingScale: servingScale,
      prepAmountInDish: component.amount // Pass the component's amount
    });
  };

  // Handler for edit button press
  const handleEditPress = () => {
    if (!dishId) return;
    // Navigate to CreateDishScreen with dishId for editing
    navigation.navigate('CreateRecipe', { dishId });
  };

  // Add type for parameters
  const calculateScaledAmount = (baseAmount: number | null, c: DishComponent) => {
    // ... function body ...
  };

  // Add type for parameter
  const formatQuantity = (c: DishComponent) => {
    // ... function body ...
  };

  // MODIFIED: Combine loading states
  const isLoading = isKitchenIdLoading || dishLoading;

  // Re-add inline formatTime function
  const formatTime = (interval: string | null): string => {
    if (!interval) return 'N/A';
    // Handle HH:MM:SS format
    if (interval.includes(':')) {
      const parts = interval.split(':');
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      // Ignore seconds if present parts[2]
      if (isNaN(hours) || isNaN(minutes)) return 'Invalid Time';
      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes} min`;
      return '0 min'; // Or handle cases with only seconds if needed
    }
    // Handle ISO 8601 Duration format (e.g., PT1H30M)
    else if (interval.startsWith('PT')) {
      const match = interval.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2] || '0', 10);
        // const seconds = parseInt(match[3] || '0', 10);
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes} min`;
        // Handle seconds if needed: if (seconds > 0) return `${seconds} sec`;
        return '0 min';
      }
    }
    // Assume it might be just minutes as a number string
    const minutesAsNum = parseInt(interval, 10);
    if (!isNaN(minutesAsNum)) {
      const hours = Math.floor(minutesAsNum / 60);
      const minutes = minutesAsNum % 60;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes} min`;
    }
    // Fallback if format is unrecognized
    return interval;
  };

  // Only show loading screen during initial load, not error
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title={t('screens.dishDetail.loading')} showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  // Only show error screen if there's an error AFTER loading completes
  if (!isLoading && (error || !dish)) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.errorContainer]}>
        <StatusBar style="light" />
        <AppHeader title={t('common.error')} showBackButton={true} />
        <Text style={styles.errorText}>
          {error ? error.message : t('screens.dishDetail.notFound', 'Dish not found')}
        </Text>
      </SafeAreaView>
    );
  }

  // If we have no dish data but no error, return to loading state instead of showing error
  if (!dish) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title={t('screens.dishDetail.loading')} showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const directions = dish.directions ? dish.directions.split(/\r?\n/).filter((line: string) => line.trim()) : [];

  const renderComponent = (component: DishComponent, index: number) => {
    const scaledAmount = component.amount ? component.amount * servingScale : null;
    const unitAbbr = component.unit?.abbreviation || component.unit?.unit_name || '';
    const formattedComponent = formatQuantityAuto(scaledAmount, unitAbbr, component.item || undefined);

    // If it's a raw ingredient, render using simple Text
    if (!component.isPreparation) {
      return (
        <View key={component.ingredient_id} style={styles.ingredientItem}>
          <Text style={styles.ingredientName}>
            {component.name || t('common.unknownIngredient')}
          </Text>
          <View style={styles.ingredientQuantity}>
            <Text style={styles.ingredientQuantityText}>
              {formattedComponent.amount} {formattedComponent.unit}
            </Text>
          </View>
        </View>
      );
    } else {
      // Preparation rendering remains handled by PreparationCard below
      return null;
    }
  };

  // --- Calculate Scale Factor ---
  const calculateScaleFactor = () => {
    if (!dish || !dish.num_servings || dish.num_servings === 0) {
      return 1; // Default to 1 if base servings info is missing
    }
    return targetServings / dish.num_servings;
  };

  const scaleFactor = calculateScaleFactor();
  const totalYieldAmount = (dish?.serving_size || 0) * targetServings;
  const totalYieldUnit = dish?.serving_unit?.abbreviation || dish?.serving_unit?.unit_name || 'g'; // Default unit

  // ADD LOG: Log dish components just before rendering
  appLogger.log('[DishDetailScreen Render] Dish components state:', JSON.stringify(dish?.components, null, 2));

  const handleDeleteDish = async () => {
    if (!dishId) {
      appLogger.warn('Attempted to delete dish with invalid ID');
      return;
    }

    if (!kitchenId) {
      Alert.alert(
        t('common.error'),
        t('screens.home.error.missingKitchenId'),
        [{ text: t('common.ok', 'OK') }]
      );
      appLogger.error('Error deleting dish: No active kitchen selected.');
      return;
    }

    Alert.alert(
      t('alerts.confirmDeleteDishTitle', 'Confirm Deletion'),
      t('alerts.confirmDeleteDishMessage', 'Are you sure you want to delete this dish? This action cannot be undone.'),
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
          onPress: () => appLogger.log('Delete cancelled'),
        },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            appLogger.log(`Attempting to delete dish with ID: ${dishId}`);
            try {
              const { error: deleteDishError } = await supabase
                .from('dishes')
                .delete()
                .eq('dish_id', dishId)
                .eq('kitchen_id', kitchenId);

              if (deleteDishError) {
                appLogger.error(`Error deleting dish ${dishId}:`, deleteDishError);
                Alert.alert(t('common.error', 'Error'), t('alerts.errorDeletingDish', 'Failed to delete dish.'));
              } else {
                appLogger.log(`Dish ${dishId} deleted successfully.`);
                Alert.alert(t('common.success', 'Success'), t('alerts.dishDeletedSuccessfully', 'Dish deleted successfully.'));

                queryClient.invalidateQueries({ queryKey: ['dishes', { kitchen_id: kitchenId }] });

                navigation.goBack();
              }
            } catch (error: any) {
              appLogger.error("Unexpected error during dish deletion:", error);
              Alert.alert(t('common.error', 'Error'), error.message || t('alerts.errorDeletingDish', 'Failed to delete dish.'));
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <AppHeader
        title={dish.dish_name}
        showBackButton={true}
        rightComponent={
          <TouchableOpacity onPress={handleEditPress} style={styles.editButton}>
            <MaterialCommunityIcons name="pencil" size={24} color={COLORS.white} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
      >
        <Image
          source={{ uri: dish.imageUrl || 'https://via.placeholder.com/600x400' }}
          style={styles.recipeImage}
        />

        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <View style={styles.infoContainer}>
              {/* Display Total Servings */}
              {typeof dish.num_servings === 'number' && (
                <View style={styles.infoItem}>
                  <MaterialCommunityIcons name="account-multiple" size={18} color={COLORS.textLight} />
                  <Text style={styles.infoText}>
                    {t('screens.dishDetail.servingsLabel', 'Servings:')} {dish.num_servings}
                  </Text>
                </View>
              )}

              {/* Existing Info Items: Time and Servings */}
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.textLight} />
                <Text style={styles.infoText}>
                  {formatTime(dish.total_time)}
                </Text>
              </View>

              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={COLORS.textLight} />
                <Text style={styles.infoText}>
                  {t('screens.dishDetail.servingSizeLabel', 'Serving Size:')} {formatQuantityAuto(dish.serving_size, dish.serving_unit?.abbreviation || dish.serving_unit?.unit_name).amount} {formatQuantityAuto(dish.serving_size, dish.serving_unit?.abbreviation || dish.serving_unit?.unit_name).unit}
                </Text>
              </View>
            </View>
          </View>

          {/* Scale Adjust Section - Now controls Target Servings */}
          {typeof dish.num_servings === 'number' && dish.num_servings > 0 && (
            <View style={styles.servingsAdjustContainer}>
              <Text style={styles.sectionSubTitle}>
                {t('screens.dishDetail.adjustServingsLabel', 'Adjust Target Servings')}
              </Text>
              <ScaleSliderInput
                label=""
                minValue={1}
                maxValue={Math.max(10, Math.ceil(originalServings * 5))}
                step={1}
                currentValue={targetServings}
                displayValue={String(targetServings)}
                displaySuffix="servings"
                onValueChange={(newTarget: number) => {
                  setTargetServings(Math.round(newTarget));
                }}
                onSlidingComplete={(finalTarget) => {
                  setTargetServings(Math.round(finalTarget));
                }}
                onTextInputChange={(text) => {
                  const newTargetServings = parseInt(text, 10);
                  if (!isNaN(newTargetServings) && newTargetServings >= 1) {
                    const maxSliderValue = Math.max(10, Math.ceil(originalServings * 5));
                    setTargetServings(Math.min(newTargetServings, maxSliderValue));
                  } else if (text === '') {
                    setTargetServings(originalServings);
                  }
                }}
              />
            </View>
          )}

          {/* --- Ingredients Section --- */}
          {RawIngredients.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{t('screens.dishDetail.rawIngredientsTitle')}</Text>
              {RawIngredients.map((component) => renderComponent(component, 0))}
            </View>
          )}

          {/* --- Preparations Section --- */}
          {preparationComponents.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{t('screens.dishDetail.preparationsTitle')}</Text>
              {preparationComponents.map((preparation) => (
                <PreparationCard
                  key={preparation.ingredient_id}
                  component={preparation}
                  onPress={() => handlePreparationPress(preparation.ingredient_id, preparation)}
                  scaleMultiplier={servingScale}
                />
              ))}
            </View>
          )}

          {/* Show message if NO components exist at all */}
          {preparationComponents.length === 0 && RawIngredients.length === 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.noIngredientsText}>{t('screens.dishDetail.noComponents')}</Text>
            </View>
          )}

          {/* --- Directions Section --- */}
          {directions.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{t('screens.dishDetail.directionsTitle')}</Text>
              {directions.map((step: string, index: number) => (
                <View key={`direction-${index}`} style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* --- Notes Section --- */}
          {dish.cooking_notes && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{t('screens.dishDetail.notesTitle')}</Text>
              <Text style={styles.notesText}>
                {dish.cooking_notes}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.deleteButtonContainer}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteDish}
          >
            <Text style={styles.deleteButtonText}>
              {t('common.delete', 'Delete')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <UpdateNotificationBanner visible={showBanner} />
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  errorText: {
    ...FONTS.body2,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: SIZES.padding * 3,
  },
  recipeImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  contentContainer: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.padding,
  },
  recipeName: {
    ...FONTS.h1,
    color: COLORS.white,
    marginBottom: SIZES.padding / 2,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZES.padding * 2,
  },
  infoText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  servingsAdjustContainer: {
    marginVertical: SIZES.padding,
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    ...SHADOWS.small,
  },
  calculatedYieldText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginLeft: SIZES.base,
    flexShrink: 1,
  },
  sectionContainer: {
    marginVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding,
  },
  sectionTitle: {
    ...FONTS.h2,
    color: COLORS.white,
    marginBottom: SIZES.padding,
    paddingBottom: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionSubTitle: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginBottom: SIZES.base,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 0.75,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SIZES.padding,
  },
  ingredientName: {
    ...FONTS.body2,
    color: COLORS.text,
    flex: 1,
    marginRight: SIZES.base,
  },
  ingredientQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingredientQuantityText: {
    ...FONTS.body3,
    color: COLORS.textLight,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: SIZES.padding * 1.5,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.padding * 0.75,
    marginTop: 2,
  },
  instructionNumberText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  instructionText: {
    ...FONTS.body2,
    color: COLORS.text,
    flex: 1,
    lineHeight: FONTS.body2.fontSize * 1.5,
  },
  notesText: {
    ...FONTS.body2,
    color: COLORS.text,
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    ...SHADOWS.small,
    lineHeight: FONTS.body2.fontSize * 1.5,
  },
  noIngredientsText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SIZES.padding,
    fontStyle: 'italic',
  },
  editButton: {
    padding: SIZES.base,
  },
  deleteButtonContainer: {
    paddingHorizontal: SIZES.padding,
    marginTop: SIZES.padding * 2,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.padding,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    ...FONTS.h3,
    color: COLORS.white,
    fontWeight: 'bold',
  },
});

export default DishDetailScreen;
