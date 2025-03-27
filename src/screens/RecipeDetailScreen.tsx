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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { MeasurementUnit, Ingredient } from '../types';
import AppHeader from '../components/AppHeader';
import { useRecipeDetail } from '../hooks/useSupabase';

type RecipeDetailRouteProp = RouteProp<RootStackParamList, 'RecipeDetails'>;

const RecipeDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RecipeDetailRouteProp>();
  const { recipeId } = route.params;
  
  // Use dynamic data loading hook
  const { 
    recipe, 
    ingredients, 
    preparations, 
    menuSection, 
    loading, 
    error 
  } = useRecipeDetail(recipeId);

  const [servingScale, setServingScale] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState<Record<string, MeasurementUnit>>({});

  // Combine all ingredients from main recipe and preparations
  const allIngredients = useMemo(() => {
    if (!ingredients) return [];
    
    // Map API ingredients to the format expected by the component
    return ingredients.map((ingredient) => ({
      id: ingredient.ingredient_id.toString(),
      name: ingredient.name,
      quantity: ingredient.amount,
      unit: 'g' // Default unit - adjust based on your data model
    }));
  }, [ingredients]);

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
  const navigateToPreparation = (preparationIndex: number) => {
    if (preparations && preparations[preparationIndex]) {
      const prep = preparations[preparationIndex];
      navigation.navigate('PreparationDetails', {
        preparationId: prep.preparations.preparation_id,
        recipeServingScale: servingScale
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title="Loading..." showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <StatusBar style="light" />
        <AppHeader title="Error" showBackButton={true} />
        <Text style={styles.errorText}>
          {error ? error.message : "Recipe not found"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AppHeader
        title={recipe.recipe_name}
        showBackButton={true}
      />
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
                  {recipe.prep_time + recipe.cook_time} min
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
                {`${servingScale}x (${Math.round(recipe.servings * servingScale)} servings)`}
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
            {allIngredients.map((ingredient) => (
              <View key={ingredient.id} style={styles.ingredientItem}>
                <View style={styles.ingredientMain}>
                  <Text style={styles.ingredientAmount}>
                    {getDisplayValue(ingredient.quantity, ingredient.unit, ingredient.id)}
                  </Text>
                  
                  <TouchableOpacity 
                    onPress={() => toggleUnit(ingredient.id, ingredient.unit)}
                    style={styles.unitToggle}
                  >
                    <Text style={styles.unitText}>
                      {selectedUnit[ingredient.id] || ingredient.unit}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={14} color={COLORS.primary} />
                  </TouchableOpacity>
                  
                  <Text style={styles.ingredientName}>{ingredient.name}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Preparations Section */}
          {preparations && preparations.length > 0 && (
            <View style={styles.preparationsContainer}>
              <Text style={styles.sectionTitle}>Preparations</Text>
              {preparations.map((prep, index) => (
                <TouchableOpacity 
                  key={prep.preparations.preparation_id} 
                  style={styles.preparationItem}
                  onPress={() => navigateToPreparation(index)}
                >
                  <View style={styles.preparationHeader}>
                    <View style={styles.preparationTitleContainer}>
                      <Text style={styles.preparationTitle}>
                        Preparation {index + 1}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.primary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {/* Instructions Section */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <View style={styles.instructionsContent}>
              {recipe.cooking_notes.split('\n').map((instruction, index) => (
                <View key={index} style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* Notes Section */}
          <View style={styles.notesContainer}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>
              {recipe.cooking_notes || "No additional notes for this recipe."}
            </Text>
          </View>
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
    color: COLORS.text,
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
    backgroundColor: COLORS.cardBackground,
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
    backgroundColor: COLORS.inputBackground,
  },
  servingsValue: {
    ...FONTS.body2,
    color: COLORS.text,
  },
  sectionTitle: {
    ...FONTS.h2,
    color: COLORS.text,
    marginBottom: SIZES.padding,
  },
  ingredientsContainer: {
    marginVertical: SIZES.padding,
  },
  ingredientItem: {
    marginBottom: SIZES.padding,
  },
  ingredientMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingredientAmount: {
    ...FONTS.body2,
    color: COLORS.text,
    minWidth: 30,
  },
  unitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: SIZES.radius / 2,
    marginHorizontal: 8,
  },
  unitText: {
    ...FONTS.body3,
    color: COLORS.primary,
    marginRight: 4,
  },
  ingredientName: {
    ...FONTS.body2,
    color: COLORS.text,
    flex: 1,
  },
  preparationsContainer: {
    marginVertical: SIZES.padding,
  },
  preparationItem: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
    ...SHADOWS.small,
  },
  preparationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preparationTitleContainer: {
    flex: 1,
  },
  preparationTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  instructionsContainer: {
    marginVertical: SIZES.padding,
  },
  instructionsContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    ...SHADOWS.small,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: SIZES.padding,
  },
  instructionNumber: {
    backgroundColor: COLORS.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.padding,
    alignSelf: 'flex-start',
  },
  instructionNumberText: {
    ...FONTS.body2,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  instructionText: {
    ...FONTS.body2,
    color: COLORS.text,
    flex: 1,
  },
  notesContainer: {
    marginVertical: SIZES.padding,
  },
  notesText: {
    ...FONTS.body2,
    color: COLORS.text,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    ...SHADOWS.small,
  },
});

export default RecipeDetailScreen;