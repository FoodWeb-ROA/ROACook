import React, { useState, useMemo } from 'react';
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

type PreparationDetailRouteProp = RouteProp<RootStackParamList, 'PreparationDetails'>;
type PreparationDetailNavigationProp = StackNavigationProp<RootStackParamList>;

type MeasurementUnit = 'g' | 'kg' | 'ml' | 'l' | 'tbsp' | 'tsp' | 'cup' | 'oz' | 'lb' | 'count' | 'pinch';

const PreparationDetailScreen = () => {
  const navigation = useNavigation<PreparationDetailNavigationProp>();
  const route = useRoute<PreparationDetailRouteProp>();
  const { preparationId, recipeServingScale } = route.params;
  
  const { preparation, ingredients, loading, error } = usePreparationDetail(preparationId) as { 
      preparation: Preparation | null, 
      ingredients: PreparationComponentDetail[], 
      loading: boolean, 
      error: Error | null 
  };
  
  const [amountScale, setAmountScale] = useState(recipeServingScale || 1);
  const [selectedUnit, setSelectedUnit] = useState<Record<string, MeasurementUnit>>({});

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
      tsp: { tbsp: 1/3 },
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

    const scaledQuantity = quantity * amountScale;
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
    // console.log("Edit pressed for preparation:", preparationId); // Log for now
  };

  const { t } = useTranslation();

  // Separate components into nested preparations and raw ingredients
  const nestedPreparations = useMemo(() => 
    ingredients?.filter(c => c.isPreparation) || [], 
    [ingredients]
  );
  const rawIngredients = useMemo(() => 
    ingredients?.filter(c => !c.isPreparation) || [], 
    [ingredients]
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title={t('screens.preparationDetail.loading')} showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error || !preparation) {
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

  const directions = preparation.directions ? preparation.directions.split(/\r?\n/).filter((line: string) => line.trim()) : [];

  const baseYieldAmount = preparation.yield_amount;
  const currentYieldAmount = typeof baseYieldAmount === 'number' ? baseYieldAmount * amountScale : null;
  const yieldUnitAbbreviation = preparation.yield_unit?.abbreviation || preparation.yield_unit?.unit_name || '';

  const handleNestedPreparationPress = (nestedPrepId: string) => {
    navigation.push('PreparationDetails', { preparationId: nestedPrepId, recipeServingScale: amountScale });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
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
              
              {typeof currentYieldAmount === 'number' && preparation.yield_unit && (
                <View style={styles.infoItem}>
                  <MaterialCommunityIcons name="scale" size={18} color={COLORS.textLight} />
                  <Text style={styles.infoText}>
                    {currentYieldAmount.toFixed(currentYieldAmount % 1 === 0 ? 0 : 1)} {yieldUnitAbbreviation}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Scale Adjust Section */}
          {typeof baseYieldAmount === 'number' && baseYieldAmount > 0 && preparation.yield_unit && (
            <View style={styles.scaleAdjustContainer}>
              <ScaleSliderInput
                label={t('screens.preparationDetail.adjustScaleLabel', { 
                  amount: formatQuantityAuto(baseYieldAmount, yieldUnitAbbreviation).amount, 
                  unit: formatQuantityAuto(baseYieldAmount, yieldUnitAbbreviation).unit 
                })}
                minValue={0.1}
                maxValue={10}
                step={0.5}
                currentValue={amountScale}
                displayValue={amountScale.toFixed(1)}
                displaySuffix={t('screens.preparationDetail.scaleSuffix')}
                onValueChange={setAmountScale}
                onSlidingComplete={(value) => setAmountScale(Math.round(value * 2) / 2)}
                onTextInputChange={(text) => {
                  const newScale = parseFloat(text);
                  if (!isNaN(newScale) && newScale > 0) {
                    const clampedScale = Math.max(0.1, Math.min(10, newScale));
                    setAmountScale(clampedScale);
                  } else if (text === '') {
                    setAmountScale(1);
                  }
                }}
              />
            </View>
          )}
          
          {/* --- Raw Ingredients Section --- */}
          {rawIngredients.length > 0 && (
            <View style={styles.sectionContainer}> 
              <Text style={styles.sectionTitle}>{t('screens.preparationDetail.rawIngredientsTitle')}</Text>
              {rawIngredients.map((ingredient) => {
                const unitKey = (ingredient.unit?.abbreviation || ingredient.unit?.unit_name) as MeasurementUnit;
                const isToggleable = ingredient.unit && (unitOptions[unitKey]?.length || 0) > 1;
                const displayUnit = (selectedUnit[ingredient.id] || ingredient.unit?.abbreviation || ingredient.unit?.unit_name) as MeasurementUnit;
                
                return (
                  <View key={ingredient.id} style={styles.ingredientItem}>
                    <Text style={styles.ingredientName}>{capitalizeWords(ingredient.name)}</Text>
                    <TouchableOpacity 
                      style={styles.ingredientQuantity}
                      onPress={() => toggleUnit(ingredient.id, ingredient.unit)}
                      disabled={!isToggleable}
                    >
                      <Text style={styles.ingredientQuantityText}>
                        {getDisplayValue(ingredient.amount, ingredient.unit, ingredient.id)} {displayUnit}
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
                 // Construct the DishComponent like object for PreparationCard
                 const prepComponent: DishComponent = {
                   dish_id: '', 
                   ingredient_id: component.id,
                   name: component.name,
                   amount: component.amount,
                   unit: component.unit,
                   isPreparation: true,
                   preparationDetails: component.preparationDetails ? {
                        ...component.preparationDetails, // Spread existing details (includes ingredients, time, yield)
                        preparation_id: component.id, // Add necessary ID
                        name: component.name // Add necessary name
                     } as any : null,
                     rawIngredientDetails: null
                   };
                return (
                  <View key={component.id} style={styles.componentWrapper}> 
                    <PreparationCard
                      component={prepComponent}
                      scaleMultiplier={amountScale}
                      onPress={() => handleNestedPreparationPress(component.id)}
                      amountLabel={t('common.amount')}
                      hideReferenceIngredient={true}
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
  referenceIngredientContainer: {
    marginBottom: SIZES.padding,
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    ...SHADOWS.small,
  },
  referenceIngredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  referenceIngredientText: {
    ...FONTS.body2,
    color: COLORS.white,
    marginLeft: SIZES.base,
    flex: 1,
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
});

export default PreparationDetailScreen; 