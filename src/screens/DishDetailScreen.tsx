import React, { useState, useMemo, useEffect } from 'react';
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
import { Dish, DishComponent } from '../types';
import AppHeader from '../components/AppHeader';
import PreparationCard from '../components/PreparationCard';
import { useDishDetail } from '../hooks/useSupabase';
import { formatQuantityAuto } from '../utils/textFormatters';
import ScaleSliderInput from '../components/ScaleSliderInput';

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

  // Navigation handler for preparation press
  const handlePreparationPress = (preparationId: string) => {
    if (!preparationId) {
      console.warn('Attempted to navigate to preparation with invalid ID');
      return;
    }
    navigation.navigate('PreparationDetails', { preparationId, recipeServingScale: servingScale });
  };

  // Handler for edit button press
  const handleEditPress = () => {
    if (!dishId) return;
    // Navigate to CreateRecipeScreen with dishId for editing
    navigation.navigate('CreateRecipe', { dishId });
    // console.log("Edit pressed for dish:", dishId); // Log for now
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title="Loading Dish..." showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error || !dish) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.errorContainer]}>
        <StatusBar style="light" />
        <AppHeader title="Error" showBackButton={true} />
        <Text style={styles.errorText}>
          {error ? error.message : "Dish not found"}
        </Text>
      </SafeAreaView>
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
                    Servings: {dish.num_servings}
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
                  Serving Size: {formatQuantityAuto(dish.serving_size, dish.serving_unit?.abbreviation || dish.serving_unit?.unit_name).amount} {formatQuantityAuto(dish.serving_size, dish.serving_unit?.abbreviation || dish.serving_unit?.unit_name).unit}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Scale Adjust Section - Now controls Target Servings */}
          {typeof dish.num_servings === 'number' && dish.num_servings > 0 && (
            <View style={styles.servingsAdjustContainer}>
              <Text style={styles.sectionSubTitle}> 
                Adjust Target Servings (Base: {originalServings})
              </Text>
              <ScaleSliderInput
                label=""
                minValue={1}
                maxValue={Math.max(10, Math.ceil(originalServings * 5))}
                step={1}
                currentValue={targetServings}
                displayValue={String(targetServings)}
                displaySuffix="Servings"
                onValueChange={(newTarget) => {
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
                yieldBase={dish.serving_size ?? undefined}
                yieldUnitAbbr={(dish.serving_unit?.abbreviation || dish.serving_unit?.unit_name) ?? undefined}
                yieldItem={dish.serving_item ?? undefined}
              />
            </View>
          )}
          
          {/* --- Preparations Section --- */}
          {preparationComponents.length > 0 && (
            <View style={styles.sectionContainer}> 
              <Text style={styles.sectionTitle}>Preparations</Text>
              {preparationComponents.map((component) => (
                <PreparationCard 
                  key={component.ingredient_id} 
                  component={component}
                  scaleMultiplier={servingScale}
                  onPress={() => handlePreparationPress(component.ingredient_id)}
                />
              ))}
            </View>
          )}

          {/* --- Ingredients Section --- */}
          {RawIngredients.length > 0 && (
            <View style={styles.sectionContainer}> 
              <Text style={styles.sectionTitle}>Raw Ingredients</Text>
              {RawIngredients.map((component) => {
                // Calculate scaled amount and format
                const scaledAmount = component.amount ? component.amount * servingScale : null;
                const unitAbbr = component.unit?.abbreviation || component.unit?.unit_name || '';
                const formattedComponent = formatQuantityAuto(scaledAmount, unitAbbr);

                return (
                  <View key={component.ingredient_id} style={styles.ingredientItem}>
                    <Text style={styles.ingredientName}>{component.name || 'Unknown Ingredient'}</Text>
                    <View style={styles.ingredientQuantity}>
                      <Text style={styles.ingredientQuantityText}>
                        {formattedComponent.amount} {formattedComponent.unit}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Show message if NO components exist at all */}
          {preparationComponents.length === 0 && RawIngredients.length === 0 && (
             <View style={styles.sectionContainer}> 
                <Text style={styles.noIngredientsText}>No components listed for this dish.</Text>
             </View>
          )}
          
          {/* --- Directions Section --- */}
          {directions.length > 0 && (
            <View style={styles.instructionsContainer}> 
              <Text style={styles.sectionTitle}>Directions</Text>
              {directions.map((step: string, index: number) => (
                <View key={index} style={styles.instructionItem}>
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
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notesText}>
                {dish.cooking_notes}
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
  instructionsContainer: {
    marginVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: SIZES.padding * 1.5,
    alignItems: 'flex-start',
    paddingHorizontal: SIZES.padding,
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
});

export default DishDetailScreen;