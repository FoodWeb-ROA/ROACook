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
import { Dish, DishComponent, Unit } from '../types';
import AppHeader from '../components/AppHeader';
import { useDishDetail } from '../hooks/useSupabase';

type MeasurementUnit = 
  | 'g' | 'kg' 
  | 'ml' | 'l' 
  | 'tsp' | 'tbsp' 
  | 'oz' | 'lb' 
  | 'cup'
  | 'count'
  | 'pinch';

type DishDetailRouteProp = RouteProp<RootStackParamList, 'DishDetails'>;
type DishDetailNavigationProp = StackNavigationProp<RootStackParamList>;

const DishDetailScreen = () => {
  const navigation = useNavigation<DishDetailNavigationProp>();
  const route = useRoute<DishDetailRouteProp>();
  const { dishId } = route.params;
  
  const { 
    dish, 
    loading, 
    error 
  } = useDishDetail(dishId);

  const [servingScale, setServingScale] = useState(1);
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
      g: { kg: 0.001 }, kg: { g: 1000 },
      ml: { l: 0.001 }, l: { ml: 1000 },
      tsp: { tbsp: 1/3 }, tbsp: { tsp: 3 },
      oz: { lb: 0.0625 }, lb: { oz: 16 },
    };
    if (fromUnit === toUnit) return value;
    const conversionFactor = conversions[fromUnit]?.[toUnit];
    const inverseConversionFactor = conversions[toUnit]?.[fromUnit];
    if (conversionFactor !== undefined) {
      return value * conversionFactor;
    } else if (inverseConversionFactor !== undefined) {
      return value / inverseConversionFactor;
    }
    console.warn(`Conversion not found for ${fromUnit} to ${toUnit}`);
    return value;
  };

  const getDisplayValue = (component: DishComponent) => {
    if (!component || typeof component.amount !== 'number' || !component.unit) {
        return 'N/A';
    }
    const { amount, unit, ingredient_id } = component;
    const scaledQuantity = amount * servingScale;
    const baseUnitAbbr = unit.abbreviation || unit.unit_name;
    const currentUnitAbbr = selectedUnit[ingredient_id] || baseUnitAbbr;
    let displayValue: number;
    
    if (currentUnitAbbr !== baseUnitAbbr) {
      displayValue = convertUnit(scaledQuantity, baseUnitAbbr, currentUnitAbbr);
    } else {
      displayValue = scaledQuantity;
    }
    
    return displayValue % 1 === 0 ? 
      displayValue.toString() : 
      displayValue.toFixed(1);
  };

  const toggleUnit = (component: DishComponent) => {
    if (!component.unit) return;
    const { ingredient_id, unit } = component;
    const baseUnitKey = (unit.abbreviation || unit.unit_name) as MeasurementUnit;
    const currentOptions = unitOptions[baseUnitKey] || [baseUnitKey];
    const currentSelected = (selectedUnit[ingredient_id] || baseUnitKey) as MeasurementUnit;
    const currentIndex = currentOptions.indexOf(currentSelected);
    const nextIndex = (currentIndex + 1) % currentOptions.length;
    
    setSelectedUnit({
      ...selectedUnit,
      [ingredient_id]: currentOptions[nextIndex],
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title="Loading Dish..." showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !dish) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <StatusBar style="light" />
        <AppHeader title="Error" showBackButton={true} />
        <Text style={styles.errorText}>
          {error ? error.message : "Dish not found"}
        </Text>
      </View>
    );
  }

  const directions = dish.directions ? dish.directions.split(/\r?\n/).filter((line: string) => line.trim()) : [];

  const formatTime = (interval: string | null): string => {
      if (!interval) return 'N/A';
      if (interval.includes(':')) {
          const parts = interval.split(':');
          const hours = parseInt(parts[0]);
          const minutes = parseInt(parts[1]);
          if (hours > 0) return `${hours}h ${minutes}m`;
          return `${minutes} min`;
      } else if (interval.startsWith('PT')) {
          const match = interval.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
           if (match) {
              const hours = parseInt(match[1] || '0');
              const minutes = parseInt(match[2] || '0');
              if (hours > 0) return `${hours}h ${minutes}m`;
              return `${minutes} min`;
          }
      }
      return interval;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AppHeader
        title={dish.dish_name}
        showBackButton={true}
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
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.textLight} />
                <Text style={styles.infoText}>
                  {formatTime(dish.total_time)}
                </Text>
              </View>
              
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={COLORS.textLight} />
                <Text style={styles.infoText}>
                  {dish.serving_size || 'N/A'} {dish.serving_unit?.abbreviation || dish.serving_unit?.unit_name || 'servings'}
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
                {`${servingScale}x (${Math.round((dish.serving_size || 1) * servingScale)} servings)`}
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
            <Text style={styles.sectionTitle}>Components</Text>
            {dish.components && dish.components.length > 0 ? dish.components.map((component) => {
              const unitKey = (component.unit?.abbreviation || component.unit?.unit_name) as MeasurementUnit;
              const isToggleable = component.unit && (unitOptions[unitKey]?.length || 0) > 1;
              const displayUnit = (selectedUnit[component.ingredient_id] || component.unit?.abbreviation || component.unit?.unit_name) as MeasurementUnit;
              
              return (
                <View key={component.ingredient_id} style={styles.ingredientItem}>
                  <Text style={styles.ingredientName}>{component.ingredient_id || 'Unknown'}</Text>
                  <TouchableOpacity 
                    style={styles.ingredientQuantity}
                    onPress={() => toggleUnit(component)}
                    disabled={!isToggleable}
                  >
                    <Text style={styles.ingredientQuantityText}>
                      {getDisplayValue(component)} {displayUnit}
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
            }) : (
              <Text style={styles.noItemsText}>No components listed for this dish.</Text>
            )}
          </View>
          
          <View style={styles.instructionsContainer}>
            <Text style={styles.sectionTitle}>Directions</Text>
            
            {directions.length > 0 ? directions.map((step: string, index: number) => (
              <View key={`direction-${index}`} style={styles.instructionStep}>
                <Text style={styles.instructionNumber}>{index + 1}.</Text>
                <Text style={styles.instructionText}>{step}</Text>
              </View>
            )) : (
              <Text style={styles.noItemsText}>No directions provided.</Text>
            )}
          </View>
          
          {dish.cooking_notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notesText}>
                {dish.cooking_notes}
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
  instructionStep: {
    flexDirection: 'row',
    marginBottom: SIZES.padding,
  },
  instructionNumber: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginRight: SIZES.padding,
    minWidth: 20,
  },
  instructionText: {
    ...FONTS.body3,
    color: COLORS.text,
    flex: 1,
    lineHeight: 22,
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
  noItemsText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SIZES.padding,
    fontStyle: 'italic',
  },
});

export default DishDetailScreen;