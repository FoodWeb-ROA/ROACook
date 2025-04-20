import React, { useState } from 'react';
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
import { Preparation, PreparationIngredient } from '../types';
import AppHeader from '../components/AppHeader';
import { usePreparationDetail } from '../hooks/useSupabase';
import { formatQuantityAuto } from '../utils/textFormatters';
import ScaleSliderInput from '../components/ScaleSliderInput';

type PreparationDetailRouteProp = RouteProp<RootStackParamList, 'PreparationDetails'>;
type PreparationDetailNavigationProp = StackNavigationProp<RootStackParamList>;

const PreparationDetailScreen = () => {
  const navigation = useNavigation<PreparationDetailNavigationProp>();
  const route = useRoute<PreparationDetailRouteProp>();
  const { preparationId, recipeServingScale } = route.params;
  
  const { preparation, ingredients, loading, error } = usePreparationDetail(preparationId) as { 
      preparation: Preparation | null, 
      ingredients: PreparationIngredient[], 
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title="Loading Preparation..." showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error || !preparation) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.errorContainer]}>
        <StatusBar style="light" />
        <AppHeader title="Error" showBackButton={true} />
        <Text style={styles.errorText}>
          {error ? error.message : "Preparation not found"}
        </Text>
      </SafeAreaView>
    );
  }

  const directions = preparation.directions ? preparation.directions.split(/\r?\n/).filter((line: string) => line.trim()) : [];

  const baseYieldAmount = preparation.yield_amount;
  const currentYieldAmount = typeof baseYieldAmount === 'number' ? baseYieldAmount * amountScale : null;
  const yieldUnitAbbreviation = preparation.yield_unit?.abbreviation || preparation.yield_unit?.unit_name || '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <AppHeader
        title={preparation.name || 'Preparation'}
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
                  {preparation.total_time} min
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
                label={`Adjust Scale (Base Yield: ${formatQuantityAuto(baseYieldAmount, yieldUnitAbbreviation).amount} ${formatQuantityAuto(baseYieldAmount, yieldUnitAbbreviation).unit})`}
                minValue={0.1}
                maxValue={10}
                step={0.5}
                currentValue={amountScale}
                displayValue={amountScale.toFixed(1)}
                displaySuffix="x scale"
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
          
          <View style={styles.ingredientsContainer}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {ingredients.map((ingredient) => {
              const unitKey = (ingredient.unit?.abbreviation || ingredient.unit?.unit_name) as MeasurementUnit;
              const isToggleable = ingredient.unit && (unitOptions[unitKey]?.length || 0) > 1;
              const displayUnit = (selectedUnit[ingredient.ingredient_id] || ingredient.unit?.abbreviation || ingredient.unit?.unit_name) as MeasurementUnit;

              return (
                <View key={ingredient.ingredient_id} style={styles.ingredientItem}>
                  <Text style={styles.ingredientName}>{ingredient.name}</Text>
                  <TouchableOpacity 
                    style={styles.ingredientQuantity}
                    onPress={() => toggleUnit(ingredient.ingredient_id, ingredient.unit)}
                    disabled={!isToggleable}
                  >
                    <Text style={styles.ingredientQuantityText}>
                      {getDisplayValue(ingredient.amount, ingredient.unit, ingredient.ingredient_id)} {displayUnit}
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
          
          <View style={styles.instructionsContainer}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            {directions.map((instruction: string, index: number) => (
              <View key={`instruction-${index}`} style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{instruction}</Text>
              </View>
            ))}
          </View>
          
          {preparation.cooking_notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.sectionTitle}>Cooking Notes</Text>
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
    paddingHorizontal: SIZES.padding * 2,
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
  },
  ingredientsContainer: {
    marginVertical: SIZES.padding,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.tertiary,
  },
  ingredientName: {
    ...FONTS.body2,
    color: COLORS.white,
    flex: 1,
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
  instructionsContainer: {
    marginVertical: SIZES.padding,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: SIZES.padding,
  },
  instructionNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.padding,
    marginTop: 2,
  },
  instructionNumberText: {
    ...FONTS.body2,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  instructionText: {
    ...FONTS.body2,
    color: COLORS.white,
    flex: 1,
  },
  notesContainer: {
    marginVertical: SIZES.padding,
  },
  notesText: {
    ...FONTS.body2,
    color: COLORS.white,
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    ...SHADOWS.small,
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
  },
});

export default PreparationDetailScreen; 