import React, { useState } from 'react';
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
import { usePreparationDetail } from '../hooks/useSupabase';

type PreparationDetailRouteProp = RouteProp<RootStackParamList, 'PreparationDetails'>;
type PreparationDetailNavigationProp = StackNavigationProp<RootStackParamList>;

const PreparationDetailScreen = () => {
  const navigation = useNavigation<PreparationDetailNavigationProp>();
  const route = useRoute<PreparationDetailRouteProp>();
  const { preparationId, recipeServingScale } = route.params;
  
  // Use dynamic data loading hook
  const { preparation, ingredients, loading, error } = usePreparationDetail(preparationId);
  
  const [amountScale, setAmountScale] = useState(recipeServingScale || 1);
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
    const scaledQuantity = quantity * amountScale;
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

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title="Loading..." showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !preparation) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <StatusBar style="light" />
        <AppHeader title="Error" showBackButton={true} />
        <Text style={styles.errorText}>
          {error ? error.message : "Preparation not found"}
        </Text>
      </View>
    );
  }

  // Parse directions into steps if they exist
  const directions = preparation.directions ? preparation.directions.split(/\r?\n/).filter((line: string) => line.trim()) : [];

  // Calculate current amount with scaling
  const currentAmount = preparation.amount ? preparation.amount * amountScale : 0;
  const unitAbbreviation = preparation.unit?.abbreviation || preparation.unit?.name || '';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AppHeader
        title={preparation.preparation_name}
        showBackButton={true}
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
              
              {preparation.amount > 0 && preparation.unit && (
                <View style={styles.infoItem}>
                  <MaterialCommunityIcons name="scale" size={18} color={COLORS.textLight} />
                  <Text style={styles.infoText}>
                    {currentAmount.toFixed(currentAmount % 1 === 0 ? 0 : 1)} {unitAbbreviation}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          {preparation.amount > 0 && (
            <View style={styles.amountAdjustContainer}>
              <Text style={styles.sectionTitle}>Adjust Amount</Text>
              <View style={styles.amountAdjustControls}>
                <TouchableOpacity 
                  style={styles.amountButton}
                  onPress={() => setAmountScale(prev => Math.max(0.5, prev - 0.5))}
                  disabled={amountScale <= 0.5}
                >
                  <MaterialCommunityIcons 
                    name="minus" 
                    size={20} 
                    color={amountScale <= 0.5 ? COLORS.disabled : COLORS.primary} 
                  />
                </TouchableOpacity>
                
                <View style={styles.amountValueContainer}>
                  <Text style={styles.amountValue}>
                    {`${amountScale}x`}
                  </Text>
                  <Text style={styles.amountTotal}>
                    {currentAmount.toFixed(currentAmount % 1 === 0 ? 0 : 1)} {unitAbbreviation}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.amountButton}
                  onPress={() => setAmountScale(prev => prev + 0.5)}
                >
                  <MaterialCommunityIcons name="plus" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
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
});

export default PreparationDetailScreen; 