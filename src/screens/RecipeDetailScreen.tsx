import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { MeasurementUnit } from '../types';
import AppHeader from '../components/AppHeader';
import { useRecipeDetail } from '../hooks/useSupabase';

type RecipeDetailRouteProp = RouteProp<RootStackParamList, 'RecipeDetails'>;
type RecipeDetailNavigationProp = StackNavigationProp<RootStackParamList>;

const RecipeDetailScreen = () => {
  const navigation = useNavigation<RecipeDetailNavigationProp>();
  const route = useRoute<RecipeDetailRouteProp>();
  const { recipeId } = route.params;
  
  // Use dynamic data loading hook
  const { 
    recipe, 
    ingredients, 
    preparations, 
    loading, 
    error 
  } = useRecipeDetail(recipeId);

  const [servingScale, setServingScale] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState<Record<string, MeasurementUnit>>({});

  // Units for conversion
  const unitOptions = {
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
  };

  // Function to convert between units
  const convertUnit = (value: number, fromUnit: string, toUnit: string): number => {
    // Conversion constants
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

  // Get display value for ingredient
  const getDisplayValue = (quantity: number, unit: string, ingredientId: string) => {
    const scaledQuantity = quantity * servingScale;
    const currentUnit = selectedUnit[ingredientId] || unit;
    
    if (currentUnit !== unit) {
      return convertUnit(scaledQuantity, unit, currentUnit).toFixed(2);
    }
    
    return unit === 'count' ? 
      Math.round(scaledQuantity).toString() : 
      scaledQuantity % 1 === 0 ? 
        scaledQuantity.toString() : 
        scaledQuantity.toFixed(1);
  };

  // Toggle between unit options for an ingredient
  const toggleUnit = (ingredientId: string, currentUnit: string) => {
    const options = unitOptions[currentUnit as keyof typeof unitOptions] || [currentUnit];
    const currentIndex = options.indexOf(selectedUnit[ingredientId] || currentUnit);
    const nextIndex = (currentIndex + 1) % options.length;
    
    setSelectedUnit({
      ...selectedUnit,
      [ingredientId]: options[nextIndex] as MeasurementUnit,
    });
  };

  // Function to navigate to preparation details
  const navigateToPreparation = (preparationId: string) => {
    navigation.navigate('PreparationDetails', {
      preparationId,
      recipeServingScale: servingScale
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar style="light" />
        <View style={{ marginTop: SIZES.verticalPadding }}>
          <AppHeader title="Loading..." showBackButton={true} />
        </View>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <StatusBar style="light" />
        <View style={{ marginTop: SIZES.verticalPadding }}>
          <AppHeader title="Error" showBackButton={true} />
        </View>
        <Text style={styles.errorText}>
          {error ? error.message : "Recipe not found"}
        </Text>
      </View>
    );
  }

  // Parse directions into steps if they exist
  const directions = recipe.directions ? recipe.directions.split(/\r?\n/).filter((line: string) => line.trim()) : [];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={{ marginTop: SIZES.verticalPadding }}>
        <AppHeader
          title={recipe.recipe_name}
          showBackButton={true}
        />
      </View>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
      >
        <Image 
          source={{ uri: 'https://via.placeholder.com/600x400' }} 
          style={styles.recipeImage} 
        />
        
        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>            
            <View style={styles.infoContainer}>
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.textLight} />
                <Text style={styles.infoText}>
                  {recipe.total_time} min
                </Text>
              </View>
              
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={COLORS.textLight} />
                <Text style={styles.infoText}>
                  {recipe.servings} servings
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.servingsAdjustContainer}>
            <Text style={styles.sectionTitle}>Adjust Servings</Text>
            <View style={styles.servingsAdjustControls}>
              <TouchableOpacity 
                style={styles.servingsButton}
                onPress={() => setServingScale(prev => Math.max(0.5, prev - 0.5))}
                disabled={servingScale <= 0.5}
              >
                <MaterialCommunityIcons 
                  name="minus" 
                  size={20} 
                  color={servingScale <= 0.5 ? COLORS.disabled : COLORS.primary} 
                />
              </TouchableOpacity>
              
              <Text style={styles.servingsValue}>
                {`${servingScale}x (${Math.round(parseInt(recipe.servings.toString()) * servingScale)} servings)`}
              </Text>
              
              <TouchableOpacity 
                style={styles.servingsButton}
                onPress={() => setServingScale(prev => prev + 0.5)}
              >
                <MaterialCommunityIcons name="plus" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.ingredientsContainer}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {ingredients.map((ingredient) => (
              <View key={ingredient.id} style={styles.ingredientItem}>
                <Text style={styles.ingredientName}>{ingredient.name}</Text>
                <TouchableOpacity 
                  style={styles.ingredientQuantity}
                  onPress={() => toggleUnit(ingredient.id, ingredient.unit)}
                >
                  <Text style={styles.ingredientQuantityText}>
                    {getDisplayValue(ingredient.quantity, ingredient.unit, ingredient.id)} {selectedUnit[ingredient.id] || ingredient.unit}
                  </Text>
                  <MaterialCommunityIcons 
                    name="swap-horizontal" 
                    size={16} 
                    color={COLORS.primary} 
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          
          <View style={styles.instructionsContainer}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            
            {/* First, render all preparation blocks */}
            {preparations && preparations.length > 0 && (
              <View style={styles.preparationsContainer}>
                <Text style={styles.preparationsTitle}>Preparations</Text>
                
                {/* Map through all preparations */}
                {preparations.map((preparation, prepIndex) => {
                  // Get the amount and unit info
                  const amount = preparation.amount;
                  const unitName = preparation.units?.abbreviation || preparation.units?.unit_name || '';
                  
                  return (
                    <TouchableOpacity
                      key={`prep-${preparation.preparation_id}`}
                      style={styles.preparationBlock}
                      onPress={() => navigateToPreparation(preparation.preparation_id)}
                    >
                      <View style={styles.preparationHeader}>
                        <View style={styles.preparationTitleWrapper}>
                          <Text style={styles.preparationTitle}>
                            {preparation.preparations.preparation_name}
                          </Text>
                          {amount > 0 && (
                            <View style={styles.preparationAmountBadge}>
                              <Text style={styles.preparationAmount}>
                                {amount} {unitName}
                              </Text>
                            </View>
                          )}
                        </View>
                        <MaterialCommunityIcons 
                          name="chevron-right" 
                          size={24} 
                          color={COLORS.white} 
                        />
                      </View>
                      
                      {/* Display preparation instructions */}
                      {preparation.preparations.directions && preparation.preparations.directions.split(/\r?\n/).filter((line: string) => line.trim()).map((step: string, idx: number) => (
                        <View 
                          key={`prep-${preparation.preparation_id}-step-${idx}`} 
                          style={styles.preparationInstructionItem}
                        >
                          <Text style={styles.preparationInstructionNumber}>{idx + 1}.</Text>
                          <Text style={styles.preparationInstructionText}>{step}</Text>
                        </View>
                      ))}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            
            {/* Then, render the main recipe directions */}
            <View style={styles.mainInstructionsContainer}>
              <Text style={styles.mainInstructionsTitle}>Main Directions</Text>
              
              {directions.map((instruction: string, index: number) => (
                <View key={`main-inst-${index}`} style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))}
            </View>
          </View>
          
          {recipe.cooking_notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.sectionTitle}>Cooking Notes</Text>
              <Text style={styles.notesText}>
                {recipe.cooking_notes}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    paddingHorizontal: SIZES.padding * 2,
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
  servingsAdjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SIZES.padding / 2,
  },
  servingsButton: {
    padding: 8,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.background,
  },
  servingsValue: {
    ...FONTS.body2,
    color: COLORS.white,
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
  preparationsContainer: {
    marginBottom: SIZES.padding * 2,
  },
  preparationsTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
    marginBottom: SIZES.padding,
    fontWeight: 'bold',
  },
  preparationBlock: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginLeft: 30,
    marginRight: 0,
    marginBottom: SIZES.padding * 2,
    ...SHADOWS.medium,
  },
  preparationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.secondary,
    paddingBottom: 8,
  },
  preparationTitleWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  preparationTitle: {
    ...FONTS.h3,
    color: COLORS.white,
    fontWeight: 'bold',
    marginRight: 8,
  },
  preparationAmountBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  preparationAmount: {
    ...FONTS.body3,
    color: COLORS.white,
  },
  preparationInstructionItem: {
    flexDirection: 'row',
    marginBottom: SIZES.padding,
  },
  preparationInstructionNumber: {
    ...FONTS.body3,
    color: COLORS.white,
    width: 25,
    fontWeight: 'bold',
  },
  preparationInstructionText: {
    ...FONTS.body3,
    color: COLORS.white,
    flex: 1,
  },
  mainInstructionsContainer: {
    marginBottom: SIZES.padding * 2,
  },
  mainInstructionsTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
    marginBottom: SIZES.padding,
    fontWeight: 'bold',
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
});

export default RecipeDetailScreen;