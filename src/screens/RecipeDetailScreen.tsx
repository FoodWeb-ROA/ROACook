import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { MeasurementUnit, Ingredient } from '../types';
import AppHeader from '../components/AppHeader';

type RecipeDetailRouteProp = RouteProp<RootStackParamList, 'RecipeDetails'>;

const RecipeDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RecipeDetailRouteProp>();
  const { recipe } = route.params;
  
  // Debug log to see if the recipe has preparations
  console.log('Recipe:', recipe.name);
  console.log('Has preparations:', !!recipe.preparations);
  console.log('Preparation count:', recipe.preparations?.length || 0);
  if (recipe.preparations) {
    recipe.preparations.forEach((prep, index) => {
      console.log(`Preparation ${index + 1}:`, prep.name);
    });
  }

  const [servingScale, setServingScale] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState<Record<string, MeasurementUnit>>({});

  // Combine all ingredients from main recipe and preparations
  const allIngredients = useMemo(() => {
    const ingredients: Ingredient[] = [...recipe.ingredients];
    
    // Add ingredients from all preparations
    if (recipe.preparations) {
      recipe.preparations.forEach(prep => {
        prep.ingredients.forEach(ingredient => {
          // Check if ingredient already exists (by name) and update quantity if it does
          const existingIngredient = ingredients.find(i => i.name === ingredient.name && i.unit === ingredient.unit);
          if (existingIngredient) {
            existingIngredient.quantity += ingredient.quantity;
          } else {
            // Add a new ingredient
            ingredients.push({
              ...ingredient,
              id: `${prep.id}-${ingredient.id}` // Create a unique ID
            });
          }
        });
      });
    }
    
    return ingredients;
  }, [recipe]);

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
    if (recipe.preparations && recipe.preparations[preparationIndex]) {
      navigation.navigate('PreparationDetails', {
        preparation: recipe.preparations[preparationIndex],
        recipeServingScale: servingScale
      });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AppHeader
        title={recipe.name}
        showBackButton={true}
      />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
      >
        <Image 
          source={{ uri: recipe.imageUrl || 'https://via.placeholder.com/600x400' }} 
          style={styles.recipeImage} 
        />
        
        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>            
            <View style={styles.infoContainer}>
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.textLight} />
                <Text style={styles.infoText}>
                  {recipe.prepTime + recipe.cookTime} min
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
            {recipe.preparations && recipe.preparations.length > 0 && (
              <View style={styles.preparationsContainer}>
                <Text style={styles.preparationsTitle}>Preparations</Text>
                
                {/* Map through all preparations */}
                {recipe.preparations.map((preparation, prepIndex) => (
                  <TouchableOpacity
                    key={`prep-${preparation.id}`}
                    style={styles.preparationBlock}
                    onPress={() => navigateToPreparation(prepIndex)}
                  >
                    <View style={styles.preparationHeader}>
                      <Text style={styles.preparationTitle}>
                        {preparation.name}
                      </Text>
                      <MaterialCommunityIcons 
                        name="chevron-right" 
                        size={24} 
                        color={COLORS.white} 
                      />
                    </View>
                    
                    {/* Display preparation instructions */}
                    {preparation.instructions.map((prepInstruction, instructionIndex) => (
                      <View 
                        key={`prep-${preparation.id}-inst-${instructionIndex}`} 
                        style={styles.preparationInstructionItem}
                      >
                        <Text style={styles.preparationInstructionNumber}>{instructionIndex + 1}.</Text>
                        <Text style={styles.preparationInstructionText}>{prepInstruction}</Text>
                      </View>
                    ))}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            {/* Then, render the main recipe directions */}
            <View style={styles.mainInstructionsContainer}>
              <Text style={styles.mainInstructionsTitle}>Main Directions</Text>
              
              {recipe.instructions.map((instruction, index) => (
                <View key={`main-inst-${index}`} style={styles.instructionItem}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))}
            </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 120, // Extra padding for tab bar
  },
  recipeImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  contentContainer: {
    flex: 1,
    padding: SIZES.padding * 2,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    marginBottom: SIZES.padding * 2,
  },
  recipeName: {
    ...FONTS.h1,
    color: COLORS.white,
    marginBottom: SIZES.padding,
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
    ...FONTS.body2,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  servingsAdjustContainer: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.padding * 2,
    ...SHADOWS.small,
  },
  servingsAdjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SIZES.padding,
  },
  servingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  servingsValue: {
    ...FONTS.h4,
    color: COLORS.white,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.white,
    marginBottom: SIZES.padding,
  },
  ingredientsContainer: {
    marginBottom: SIZES.padding * 2,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    marginBottom: SIZES.padding * 2,
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
  preparationTitle: {
    ...FONTS.h3,
    color: COLORS.white,
    fontWeight: 'bold',
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
  preparationsContainer: {
    marginBottom: SIZES.padding * 2,
  },
  preparationsTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
    marginBottom: SIZES.padding,
    fontWeight: 'bold',
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
});

export default RecipeDetailScreen;