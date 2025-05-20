import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { Preparation, PreparationIngredient, Unit, DishComponent } from '../types';
import AppHeader from '../components/AppHeader';
import { usePreparationDetail, PreparationComponentDetail } from '../hooks/useSupabase';
import { formatQuantityAuto, capitalizeWords } from '../utils/textFormatters';
import ScaleSliderInput from '../components/ScaleSliderInput';
import { useTranslation } from 'react-i18next';
import PreparationCard from '../components/PreparationCard';
import UpdateNotificationBanner from '../components/UpdateNotificationBanner';
import { useTypedSelector } from '../hooks/useTypedSelector';
import { supabase } from '../data/supabaseClient';
import { queryClient } from '../data/queryClient';
import { appLogger } from '../services/AppLogService';

type PreparationDetailRouteProp = RouteProp<RootStackParamList, 'PreparationDetails'>;
type PreparationDetailNavigationProp = StackNavigationProp<RootStackParamList>;

type MeasurementUnit = 'g' | 'kg' | 'ml' | 'l' | 'tbsp' | 'tsp' | 'cup' | 'oz' | 'lb' | 'count' | 'pinch';

const PreparationDetailScreen = () => {
  const navigation = useNavigation<PreparationDetailNavigationProp>();
  const route = useRoute<PreparationDetailRouteProp>();
  const { preparationId, recipeServingScale, prepAmountInDish } = route.params;

  console.log(`--- PreparationDetailScreen/route.params:`, route.params);

  // Determine if navigated from a dish context
  const isFromDishContext = prepAmountInDish !== null && prepAmountInDish !== undefined;

  const { preparation, ingredients, loading, error, lastUpdateTime } = usePreparationDetail(preparationId) as {
    preparation: Preparation | null,
    ingredients: (PreparationIngredient & { isPreparation?: boolean })[],
    loading: boolean,
    error: Error | null,
    lastUpdateTime: number | null
  };

  appLogger.log('[PreparationDetailScreen] Received ingredients:', JSON.stringify(ingredients, null, 2));
 
  const [selectedUnit, setSelectedUnit] = useState<Record<string, MeasurementUnit>>({});
  const { t } = useTranslation();
  const [showBanner, setShowBanner] = useState(false);
  const lastUpdateTimeRef = useRef<number | null>(null);

  const unitOptions: Record<MeasurementUnit, MeasurementUnit[]> = {
    g: ['g', 'kg'],
    kg: ['g', 'kg'],
    ml: ['ml', 'l'],
    l: ['ml', 'l'],
    tbsp: ['tbsp', 'tsp'],
    tsp: ['tsp', 'tbsp'],
    cup: ['cup'],
    oz: ['oz', 'lb'],
    lb: ['oz', 'lb'],
    count: ['count'],
    pinch: ['pinch'],
  };

  const convertUnit = (value: number, fromUnit: string, toUnit: string): number => {
    const conversions: Record<string, Record<string, number>> = {
      g: { kg: 0.001 },
      kg: { g: 1000 },
      ml: { l: 0.001 },
      l: { ml: 1000 },
      tsp: { tbsp: 1 / 3 },
      tbsp: { tsp: 3 },
      oz: { lb: 0.0625 },
      lb: { oz: 16 },
    };

    if (fromUnit === toUnit) return value;
    return value * (conversions[fromUnit]?.[toUnit] || 0);
  };

  const getDisplayValue = (quantity: number | null, unitObj: { abbreviation?: string | null, unit_name?: string | null } | null, ingredientId: string) => {
    if (quantity === null || quantity === undefined || !unitObj) return 'N/A';
    const unit = unitObj.abbreviation || unitObj.unit_name;
    if (!unit) return quantity.toString();

    const scaledQuantity = quantity * currentServingScale;
    const currentUnit = selectedUnit[ingredientId] || unit;
    let displayValue: number;

    if (currentUnit !== unit) {
      displayValue = convertUnit(scaledQuantity, unit, currentUnit);
    } else {
      displayValue = scaledQuantity;
    }

    return displayValue % 1 === 0 ?
      displayValue.toString() :
      displayValue.toFixed(1);
  };

  const toggleUnit = (ingredientId: string, unitObj: { abbreviation?: string | null, unit_name?: string | null } | null) => {
    if (!unitObj) return;
    const baseUnitKey = (unitObj.abbreviation || unitObj.unit_name) as MeasurementUnit;
    if (!unitOptions[baseUnitKey]) return;

    const currentOptions = unitOptions[baseUnitKey];
    const currentSelected = (selectedUnit[ingredientId] || baseUnitKey) as MeasurementUnit;
    const currentIndex = currentOptions.indexOf(currentSelected);
    const nextIndex = (currentIndex + 1) % currentOptions.length;

    setSelectedUnit({
      ...selectedUnit,
      [ingredientId]: currentOptions[nextIndex],
    });
  };

  const handleEditPress = () => {
    if (!preparationId) return;
    // Navigate to CreateRecipeScreen with preparationId for editing
    navigation.navigate('CreateRecipe', { preparationId });
  };

  // Use the ingredients array directly from the hook
  const nestedPreparations = useMemo(() =>
    ingredients?.filter(c => c.isPreparation === true) || [],
    [ingredients]
  );

  appLogger.log('[PreparationDetailScreen] Filtered nestedPreparations:', JSON.stringify(nestedPreparations, null, 2));
  
  const rawIngredients = useMemo(() => 
    ingredients?.filter(c => c.isPreparation !== true) || [], // Treat undefined or false as raw
    [ingredients]
  );
  // ADD LOG: Log raw ingredients array
  appLogger.log('[PreparationDetailScreen] Filtered rawIngredients:', JSON.stringify(rawIngredients, null, 2));

  // Effect to show banner on update
  useEffect(() => {
    if (lastUpdateTime && lastUpdateTime !== lastUpdateTimeRef.current) {
      setShowBanner(true);
      lastUpdateTimeRef.current = lastUpdateTime;
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 3000); // Hide banner after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [lastUpdateTime]);

  // Only show loading screen during initial load, not error
  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title={t('screens.preparationDetail.loading')} showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  // Only show error screen if there's an error AFTER loading completes
  if (!loading && (error || !preparation)) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.errorContainer]}>
        <StatusBar style="light" />
        <AppHeader title={t('screens.preparationDetail.error')} showBackButton={true} />
        <Text style={styles.errorText}>
          {error ? error.message : t('screens.preparationDetail.errorNotFound')}
        </Text>
      </SafeAreaView>
    );
  }

  // If we have no preparation data but no error, return to loading state instead of showing error
  if (!preparation) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title={t('screens.preparationDetail.loading')} showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const directions = preparation.directions ? preparation.directions.split(/\r?\n/).filter((line: string) => line.trim()) : [];

  const baseYieldAmount = preparation.yield_amount;
  const yieldUnitAbbreviation = preparation.yield_unit?.abbreviation || preparation.yield_unit?.unit_name || '';

  // Ensure recipeServingScale has a default value and calculate scaled yield
  const currentServingScale = recipeServingScale ?? 1;
  const scaledYieldAmount = typeof baseYieldAmount === 'number' ? baseYieldAmount * currentServingScale : null;
  // Format the scaled yield for display using formatQuantityAuto
  const formattedScaledYield = formatQuantityAuto(scaledYieldAmount, yieldUnitAbbreviation);

  const handleNestedPreparationPress = (nestedPrepId: string) => {
    // Pass the currentServingScale down to the nested preparation screen
    navigation.push('PreparationDetails', {
      preparationId: nestedPrepId,
      recipeServingScale: currentServingScale // Pass the scale down
    });
  };

  const handleDeletePreparation = async () => {
    if (!preparationId) {
      console.warn('Attempted to delete preparation with invalid ID');
      return;
    }

    console.log(`Checking if preparation ${preparationId} is used in any dishes...`);
    try {
      const { count, error: countError } = await supabase
        .from('dish_components')
        .select('dish_id', { count: 'exact', head: true })
        .eq('ingredient_id', preparationId);

      if (countError) throw countError;

      console.log(`Preparation ${preparationId} used in ${count} dish components.`);

      if (count && count > 0) {
        Alert.alert(
          'Cannot Delete Preparation',
          `This preparation cannot be deleted because it is used in ${count} dish component(s). Please remove it from the relevant dishes first.`,
          [{ text: t('common.ok', 'OK') }]
        );
        return;
      }
    } catch (checkError: any) {
      console.error(`Error checking preparation usage for ${preparationId}:`, JSON.stringify(checkError, null, 2));

      Alert.alert(t('common.error', 'Error'), t('alerts.errorCheckingPrepUsage', 'Failed to check if preparation is used.'));
      return;
    }

    Alert.alert(
      t('alerts.confirmDeletePrepTitle', 'Confirm Deletion'),
      t('alerts.confirmDeletePrepMessage', 'Are you sure you want to delete this preparation? This action cannot be undone.'),
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
          onPress: () => console.log('Delete cancelled'),
        },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            console.log(`Preparation ${preparationId} is not used. Proceeding with deletion...`);
            try {
              const { error: deletePrepError } = await supabase
                .from('preparations')
                .delete()
                .eq('preparation_id', preparationId);


              if (deletePrepError) {
                console.error(`Error deleting preparation ${preparationId}:`, deletePrepError);
                Alert.alert(t('common.error', 'Error'), t('alerts.errorDeletingPrep', 'Failed to delete preparation.'));
              } else {
                console.log(`Preparation ${preparationId} deleted successfully.`);
                Alert.alert(t('common.success', 'Success'), t('alerts.prepDeletedSuccessfully', 'Preparation deleted successfully.'));

                queryClient.invalidateQueries({ queryKey: ['preparations'] });

                navigation.goBack();
              }
            } catch (error: any) {
              console.error("Unexpected error during preparation deletion:", error);
              Alert.alert(t('common.error', 'Error'), error.message || t('alerts.errorDeletingPrep', 'Failed to delete preparation.'));
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
      <UpdateNotificationBanner visible={showBanner} />
      <AppHeader
        title={preparation.name || t('screens.preparationDetail.titleFallback')}
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
          source={{ uri: 'https://via.placeholder.com/600x400' }}
          style={styles.preparationImage}
        />

        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <View style={styles.infoContainer}>
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.textLight} />
                <Text style={styles.infoText}>
                  {preparation.total_time} {t('screens.preparationDetail.minutesSuffix')}
                </Text>
              </View>

              {/* CONDITIONAL: Display Amount in Recipe OR Base Yield */}
              {isFromDishContext && (
                // --- Display Amount Used In Recipe ---
                (() => {
                  const actualAmountNeeded = (prepAmountInDish ?? 0) * (recipeServingScale ?? 1);
                  let displayAmountText = 'N/A';

                  const prepUnitAbbr = preparation.yield_unit?.abbreviation || preparation.yield_unit?.unit_name || '';
                  const formattedAmount = formatQuantityAuto(actualAmountNeeded, prepUnitAbbr);
                  displayAmountText = `${formattedAmount.amount} ${formattedAmount.unit}`;

                  return (
                    <View style={styles.infoItem}>
                      <MaterialCommunityIcons name="scale" size={18} color={COLORS.textLight} />
                      <Text style={styles.infoText} numberOfLines={2} ellipsizeMode="tail">
                        {t('screens.preparationDetail.amountInRecipeLabel', 'Amount in Recipe')}: {displayAmountText}
                      </Text>
                    </View>
                  );
                })()
              )}
              {!isFromDishContext && preparation.yield_amount !== null && (
                // --- Display Base Yield (Scaled) ---
                (() => {
                  const baseYield = preparation.yield_amount ?? 0;
                  const scale = recipeServingScale ?? 1; // Apply recipe scale if passed directly
                  const scaledBaseYield = baseYield * scale;
                  const yieldUnitAbbr = preparation.yield_unit?.abbreviation || preparation.yield_unit?.unit_name || '';
                  const formattedYield = formatQuantityAuto(scaledBaseYield, yieldUnitAbbr);
                  return (
                    <View style={styles.infoItem}>
                      <MaterialCommunityIcons name="scale-balance" size={18} color={COLORS.textLight} />
                      <Text style={styles.infoText} numberOfLines={2} ellipsizeMode="tail">
                        {t('common.yield')}: {formattedYield.amount} {formattedYield.unit}
                      </Text>
                    </View>
                  );
                })()
              )}
            </View>
          </View>

          {/* --- Raw Ingredients Section --- */}
          {rawIngredients.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{t('screens.preparationDetail.rawIngredientsTitle')}</Text>
              {rawIngredients.map((ingredient) => {
                const unitKey = (ingredient.unit?.abbreviation || ingredient.unit?.unit_name) as MeasurementUnit;
                const isToggleable = ingredient.unit && (unitOptions[unitKey]?.length || 0) > 1;
                const displayUnit = (selectedUnit[ingredient.ingredient_id] || ingredient.unit?.abbreviation || ingredient.unit?.unit_name) as MeasurementUnit;

                // --- CONDITIONAL SCALING for main ingredient list ---
                let amountToDisplay = 0;
                const baseIngAmount = ingredient.amount ?? 0;

                if (isFromDishContext) {
                  // Scale based on amount used in dish
                  const prepBaseYield = preparation.yield_amount;
                  const scaledTargetAmount = (prepAmountInDish ?? 0) * (recipeServingScale ?? 1);

                  // Scale based on total yield
                  const scaleForDishUsage = (prepBaseYield !== null && prepBaseYield > 0 && prepAmountInDish !== null)
                    ? (prepAmountInDish / prepBaseYield) // Use unscaled prepAmountInDish for ratio
                    : 1; // Fallback scale
                  amountToDisplay = baseIngAmount * scaleForDishUsage * (recipeServingScale ?? 1);
                } else {

                  // Scale only by recipeServingScale (if viewing prep directly)
                  amountToDisplay = baseIngAmount * (recipeServingScale ?? 1);

                  appLogger.log(`[PrepDetailDirectView] Ingredient: ${ingredient.name}, Base: ${baseIngAmount}, Scale: ${recipeServingScale ?? 1}, Display: ${amountToDisplay}`);
                // --- END CONDITIONAL SCALING ---

                // Display value might still use unit conversion
                let displayValue: number;
                if (unitKey && displayUnit !== unitKey) {
                  displayValue = convertUnit(amountToDisplay, unitKey, displayUnit);
                } else {
                  displayValue = amountToDisplay;
                }

                // --- MODIFIED FORMATTING ---
                // Use formatQuantityAuto for consistency, pass null for item
                const formattedOutput = formatQuantityAuto(displayValue, displayUnit);
                const formattedValue = formattedOutput.amount;
                const formattedUnit = formattedOutput.unit; // Use the unit returned by the formatter
                // --- END MODIFIED FORMATTING ---

                // --- ADD LOGGING: Final render values ---
                appLogger.log(`[PrepDetailRender] Ing: ${ingredient.name}, AmountToDisplay: ${amountToDisplay}, DisplayValue: ${displayValue}, FormattedValue: ${formattedValue}, DisplayUnit (used for render): ${formattedUnit}`);
                // --- END LOGGING ---

                return (
                  <View key={ingredient.ingredient_id} style={styles.ingredientItem}>
                    <Text style={styles.ingredientName}>{capitalizeWords(ingredient.name)}</Text>
                    <TouchableOpacity
                      style={styles.ingredientQuantity}
                      onPress={() => toggleUnit(ingredient.ingredient_id, ingredient.unit)}
                      disabled={!isToggleable}
                    >
                      <Text style={styles.ingredientQuantityText}>
                        {/* MODIFIED: Use formattedUnit from formatQuantityAuto */}
                        {formattedValue} {formattedUnit}
                      </Text>
                      {isToggleable && (
                        <MaterialCommunityIcons
                          name="swap-horizontal"
                          size={16}
                          color={COLORS.primary}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* --- Preparations Section --- */}
          {nestedPreparations.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{t('screens.preparationDetail.preparationsTitle')}</Text>
              {nestedPreparations.map((component) => {
                // For nested preparations, we need to fetch their details when clicked
                // Construct a basic DishComponent structure for PreparationCard props
                const prepComponentForCard: DishComponent = {
                  dish_id: '', // Not relevant here
                  ingredient_id: component.ingredient_id,
                  name: component.name,
                  amount: component.amount, // Base amount from parent prep recipe
                  unit: component.unit,
                  isPreparation: true,
                  // We don't have full nested details here, card will show limited info
                  preparationDetails: {
                    preparation_id: component.ingredient_id, // ID of the nested prep
                    name: component.name,
                    directions: null,
                    total_time: null, // Not available here
                    yield_unit: null, // Not available here
                    yield_amount: null, // Not available here
                    cooking_notes: null,
                    ingredients: [], // Not available here
                  },
                  rawIngredientDetails: null
                };
                return (
                  <View key={component.ingredient_id} style={styles.componentWrapper}>
                    <PreparationCard
                      // Pass the constructed basic details
                      component={prepComponentForCard}
                      onPress={() => handleNestedPreparationPress(component.ingredient_id)}
                      // Label indicates amount used *in this parent preparation's recipe*
                      amountLabel={t('common.amount')}
                      // Scale based on the PARENT prep's scaling
                      scaleMultiplier={currentServingScale}
                    />
                  </View>
                );
              })}
            </View>
          )}

          {/* Show message if NO components exist at all */}
          {nestedPreparations.length === 0 && rawIngredients.length === 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.noIngredientsText}>{t('screens.preparationDetail.noComponents', 'No components listed for this preparation.')}</Text>
            </View>
          )}

          {/* --- Instructions Section --- */}
          {directions.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{t('screens.preparationDetail.directionsTitle')}</Text>
              {directions.map((instruction: string, index: number) => (
                <View key={`instruction-${index}`} style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))}
            </View>
          )}

          {/* --- Notes Section --- */}
          {preparation.cooking_notes && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{t('screens.preparationDetail.cookingNotesTitle')}</Text>
              <Text style={styles.notesText}>
                {preparation.cooking_notes}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.deleteButtonContainer}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeletePreparation}
          >
            <Text style={styles.deleteButtonText}>
              {t('common.delete', 'Delete')}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: SIZES.padding * 3,
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
  preparationImage: {
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
  preparationName: {
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
  amountAdjustContainer: {
    marginVertical: SIZES.padding,
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    ...SHADOWS.small,
  },
  amountAdjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SIZES.padding / 2,
  },
  amountButton: {
    padding: 8,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.background,
  },
  amountValueContainer: {
    alignItems: 'center',
  },
  amountValue: {
    ...FONTS.body2,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  amountTotal: {
    ...FONTS.body3,
    color: COLORS.white,
    marginTop: 4,
  },
  sectionTitle: {
    ...FONTS.h2,
    color: COLORS.white,
    marginBottom: SIZES.padding,
    paddingBottom: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  ingredientsContainer: {
    marginVertical: SIZES.padding,
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
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
  },
  ingredientQuantityText: {
    ...FONTS.body3,
    color: COLORS.white,
    marginRight: 4,
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
  editButton: {
    padding: SIZES.base,
  },
  scaleAdjustContainer: {
    marginVertical: SIZES.padding,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
  },
  sectionContainer: {
    marginVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding,
  },
  componentWrapper: {
    marginBottom: SIZES.base,
  },
  noIngredientsText: {
    ...FONTS.body2,
    color: COLORS.textLight,
    textAlign: 'center',
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

export default PreparationDetailScreen; 