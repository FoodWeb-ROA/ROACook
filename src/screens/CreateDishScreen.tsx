import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  LogBox,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { PREPARATION_UNIT_ID } from '../constants/units';
import { RootStackParamList, OnUpdatePrepAmountCallback, OnNewPreparationCreatedCallback } from '../navigation/types';
import { supabase } from '../data/supabaseClient';
import { Unit, MenuSection, Ingredient, RecipeKind, ParsedIngredient, ParsedRecipe, Preparation, ComponentInput, EditablePrepIngredient, PreparationIngredient } from '../types';
import { useMenuSections, useUnits, useIngredients, useDishDetail, usePreparationDetail } from '../hooks/useSupabase';
import { useLookup } from '../hooks/useLookup';
import AppHeader from '../components/AppHeader';
import { TextInputChangeEventData } from 'react-native';
import PreparationCard from '../components/PreparationCard';
import { DishComponent } from '../types';
import ScaleSliderInput from '../components/ScaleSliderInput';
import { formatQuantityAuto, capitalizeWords } from '../utils/textFormatters';
import { useTranslation } from 'react-i18next';
import { appLogger } from '../services/AppLogService';

import { slug, stripDirections, fingerprintPreparation } from '../utils/normalise';
import {
  findDishByName,
  findCloseIngredient,
  checkIngredientNameExists,
  checkPreparationNameExists,
  findPreparationByFingerprint,
  fetchPreparationDetailsFromDB
} from '../data/dbLookup';
import { resolveIngredient, resolvePreparation, resolveDish } from '../services/duplicateResolver';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Database } from '../data/database.types'; // <-- CORRECTED IMPORT PATH
import { useCurrentKitchenId } from '../hooks/useSupabase';
// ADDED: Import the refreshData utility
import { refreshData } from '../utils/dataRefresh';

// Import newly created components
import DirectionsInputList from '../components/DirectionsInputList';
import ComponentSearchModal, { SearchResultItem } from '../components/ComponentSearchModal';
import IngredientListComponent from '../components/IngredientListComponent'; // ADDED
import PreparationListComponent from '../components/PreparationListComponent'; // ADDED
import { useTypedSelector } from '../hooks/useTypedSelector';
import { MeasureKind } from '../types'; 
import { unitKind, convertAmount } from '../utils/unitHelpers';

// Silence warning about text strings
LogBox.ignoreLogs(['Text strings must be rendered within a <Text> component']);

// Silence warnings
LogBox.ignoreLogs([
  'Text strings must be rendered within a <Text> component',
]);

type CreateRecipeNavigationProp = StackNavigationProp<RootStackParamList>;
// Define RouteProp type for this screen
type CreateRecipeRouteProp = RouteProp<RootStackParamList, 'CreateRecipe'>;

// Rename screen component
const CreateDishScreen = () => {
  const navigation = useNavigation<CreateRecipeNavigationProp>();
  // Get route params
  const route = useRoute<CreateRecipeRouteProp>();
  const { t } = useTranslation(); // MOVED HOOK CALL HERE
  const dishIdToEdit = route.params?.dishId;
  const preparationIdToEdit = route.params?.preparationId;
  const isEditing = !!dishIdToEdit || !!preparationIdToEdit;
  // Check for parsed recipe
  const parsedRecipe = route.params?.parsedRecipe;
  const isConfirming = !!parsedRecipe && !isEditing; // Confirming only if not editing

  // Get kitchenId to pass to hooks
  // const kitchenId = useCurrentKitchenId();
  const kitchenId = useTypedSelector(state => state.kitchens.activeKitchenId);

  // Hooks for fetching data for editing
  // Pass kitchenId to useDishDetail
  const { dish: dishToEdit, loading: loadingDish, error: dishError } = useDishDetail(dishIdToEdit, kitchenId);
  appLogger.log("[Edit Mode] preparationIdToEdit on CreateDishScreen:", preparationIdToEdit);
  const { preparation: prepToEdit, ingredients: prepComponentsToEdit, loading: loadingPrep, error: prepError } = usePreparationDetail(preparationIdToEdit);

  // --- Hooks for fetching data --- 
  const { menuSections, isLoading: loadingSections } = useMenuSections(); // <-- Renamed loading to isLoading
  const { units, loading: loadingUnits } = useUnits(); // Assumes useUnits hook exists
  // Fetch both ingredients and preparations for component selection
  const { ingredients: availableComponents, loading: loadingComponents } = useIngredients(true); // Assumes useIngredients hook exists and accepts flag

  // Add lookup hooks
  const { checkDishNameExists, lookupIngredient } = useLookup();

  // --- Form State --- 
  const [dishName, setDishName] = useState('');
  const [menuSectionId, setMenuSectionId] = useState<string | null>(null);
  const [directions, setDirections] = useState<string[]>(['']);
  const [totalTimeHours, setTotalTimeHours] = useState('0'); // Store time parts
  const [totalTimeMinutes, setTotalTimeMinutes] = useState('30');
  const [numServings, setNumServings] = useState(1); // Target servings (number)
  const [originalServings, setOriginalServings] = useState(1); // Base servings for scaling
  const [servingSize, setServingSize] = useState('1');
  const [servingUnitId, setServingUnitId] = useState<string | null>(null);
  const [cookingNotes, setCookingNotes] = useState('');
  const [servingItem, setServingItem] = useState(''); // State for serving item description

  // Initialize components state directly from route params if available
  const [components, setComponents] = useState<ComponentInput[]>(route.params?.initialComponents ?? []);

  // --- UI State --- 
  const [loading, setLoading] = useState(false); // For initial data load
  const [submitting, setSubmitting] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [servingUnitModalVisible, setServingUnitModalVisible] = useState(false);
  const [componentSearchModalVisible, setComponentSearchModalVisible] = useState(false);
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [ingredientUnitModalVisible, setIngredientUnitModalVisible] = useState(false);
  const [selectedIngredientKey, setSelectedIngredientKey] = useState<string | null>(null);
  const [currentEditingItemMeasureKind, setCurrentEditingItemMeasureKind] = useState<MeasureKind | null>(null);

  // State for Serving Item logic
  const [pieceUnitId, setPieceUnitId] = useState<string | null>(null);

  // State to track overall loading including edit data fetching
  const [isScreenLoading, setIsScreenLoading] = useState(true);

  // State to track search mode
  const [searchMode, setSearchMode] = useState<'ingredient' | 'preparation'>('ingredient');

  // Get active kitchen ID from Redux
  const activeKitchenId = useSelector((state: RootState) => state.kitchens.activeKitchenId);

  // Temporary placeholder to satisfy references until refactor completes
  const saveDishLogic = async (_id?: string) => { };

  const existingId = useRef<string | undefined>(undefined);

  // Function to create a new basic ingredient
  const createNewIngredient = async (name: string): Promise<string | null> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      appLogger.error("Cannot create ingredient: Name is empty.");
      return null;
    }
    if (!activeKitchenId) {
      appLogger.error(`Cannot create ingredient '${trimmedName}': No active kitchen selected.`);
      Alert.alert(t('common.error'), t('alerts.errorCreatingIngredientNoKitchen'));
      return null;
    }

    // Find a default unit (e.g., 'piece' or the first available unit)
    const defaultUnit = units.find(u => u.unit_name?.toLowerCase() === 'piece' || u.abbreviation?.toLowerCase() === 'x') || units[0];
    const defaultUnitId = defaultUnit?.unit_id; // This might be null/undefined if units list is empty

    if (!defaultUnitId) {
      appLogger.error(`Cannot create ingredient '${trimmedName}': No default unit found.`);
      Alert.alert(t('common.error'), t('alerts.errorCreatingIngredientNoDefaultUnit'));
      return null;
    }

    appLogger.log(`Creating new ingredient DB entry: ${trimmedName}`);
    try {
      // Basic insert - include default unit and amount
      const ingredientInsert: Database['public']['Tables']['ingredients']['Insert'] = {
        name: trimmedName,
        kitchen_id: activeKitchenId,
        unit_id: defaultUnitId, // Use resolved default unit ID
      };
      const { data, error } = await supabase
        .from('ingredients')
        .insert(ingredientInsert)
        .select('ingredient_id')
        .single();

      if (error) {
        // Handle potential duplicate name error (e.g., unique constraint)
        if (error.code === '23505') { // Unique violation
          appLogger.warn(`Ingredient named \"${trimmedName}\" likely already exists (unique constraint). Attempting lookup.`);
          // Attempt to lookup the existing ID as a fallback
          const existingIdString: string | null = await checkIngredientNameExists(trimmedName);
          if (existingIdString) return existingIdString;
        }
        appLogger.error(`Error inserting new ingredient '${trimmedName}':`, error);
        throw error; // Re-throw other errors
      }

      if (!data?.ingredient_id) {
        throw new Error("Failed to retrieve new ingredient ID after insert.");
      }

      appLogger.log(`Successfully created ingredient '${trimmedName}' with ID: ${data.ingredient_id}`);
      return data.ingredient_id;

    } catch (error) {
      appLogger.error(`Error in createNewIngredient for ${trimmedName}:`, error);
      Alert.alert(t('common.error'), t('alerts.errorCreatingIngredient', { name: trimmedName }));
      return null; // Return null on failure
    }
  };
  // --- END createNewIngredient ---

  const handlePrepSaveChanges = useCallback((prepKey: string, updatedState: {
    editableIngredients: EditablePrepIngredient[];
    prepUnitId: string | null;
    instructions: string[];
    isDirty: boolean;
    displayAmount?: string;
    scaleMultiplier?: number;
  }) => {
    setComponents(prevComponents =>
      prevComponents.map(comp => {
        if (comp.key === prepKey) {
          // Store the original preparation and its ingredients for reference
          const originalPrep = comp.originalPrep;
          
          // Create updated component with new state
          const updatedComp = {
            ...comp,
            prepStateEditableIngredients: updatedState.editableIngredients,
            prepStatePrepUnitId: updatedState.prepUnitId,
            prepStateInstructions: updatedState.instructions,
            prepStateIsDirty: updatedState.isDirty,
            // Update amount if a new displayAmount was provided
            amount: updatedState.displayAmount !== undefined 
              ? updatedState.displayAmount 
              : comp.amount,
            unit_id: PREPARATION_UNIT_ID, // Ensure unit_id is PREPARATION_UNIT_ID for preps
          };
          
          // Store the scale multiplier in the component for reference by PreparationCard
          if (updatedState.scaleMultiplier !== undefined) {
            updatedComp.prepScaleMultiplier = updatedState.scaleMultiplier;
            
            // If we have subIngredients, update their scaled amounts
            if (updatedComp.subIngredients && updatedComp.subIngredients.length > 0) {
              updatedComp.subIngredients = updatedComp.subIngredients.map(subIng => ({
                ...subIng,
                // Store original amount but add scaleFactor for display in PreparationCard/DetailScreen
                scaleFactor: updatedState.scaleMultiplier
              }));
            }
          }
          
          return updatedComp;
        }
        return comp;
      })
    );

    // Log what fields were updated
    const fieldsUpdated = ['editableIngredients', 'prepUnitId', 'instructions', 'isDirty']
      .concat(updatedState.displayAmount ? ['amount'] : [])
      .concat(updatedState.scaleMultiplier ? ['scaleMultiplier'] : []);
      
    appLogger.log(`Updated prep state for key ${prepKey}, fields: ${fieldsUpdated.join(', ')}`);
  }, []);

  const handlePrepSelect = useCallback((prepComponent: ComponentInput) => {
    if (!prepComponent.originalPrep) {
      appLogger.warn('Cannot navigate to preparation: Missing originalPrep data');
      return;
    }
    // Calculate the scale multiplier based on the current recipe servings
    const currentRecipeScale = originalServings > 0 ? numServings / originalServings : 1;

    // Calculate the actual scaled amount of this prep component used in the dish
    const baseAmountNum = parseFloat(prepComponent.amount);
    const dishComponentScaledAmount = isNaN(baseAmountNum) ? null : baseAmountNum * currentRecipeScale;

    navigation.navigate('CreatePreparation', {
      preparation: prepComponent.originalPrep,
      prepKey: prepComponent.key,
      scaleMultiplier: currentRecipeScale, // Pass the recipe's scale factor
      onUpdatePrepAmount: handlePrepSaveChanges,
      initialEditableIngredients: prepComponent.prepStateEditableIngredients,
      initialPrepUnitId: prepComponent.prepStatePrepUnitId,
      initialInstructions: prepComponent.prepStateInstructions,
      // Pass the calculated scaled amount
      dishComponentScaledAmount: dishComponentScaledAmount,
      originalPrepBaseAmount: null,
    });
  }, [navigation, originalServings, numServings, handlePrepSaveChanges]);
  const searchIngredients = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      // MODIFIED: Search based on searchMode
      if (searchMode === 'ingredient') {
        // TODO: Potentially update lookupIngredient to filter out preparations
        // Removed filter option for now
        const results = await lookupIngredient(query);
        setSearchResults(results);
      } else { // searchMode === 'preparation'
        // TODO: Implement or ensure lookupIngredient can find preparations
        // Removed filter option for now. Assumes lookupIngredient returns preparations too.
        // We might need a dedicated lookupPreparation or filter client-side later.
        const results = await lookupIngredient(query);
        // Ensure isPreparation flag is set for display, filter later if needed.
        setSearchResults(results.map((r: any) => ({ ...r, isPreparation: true })));
      }
    } catch (error) {
      appLogger.error(`Error searching ${searchMode}s:`, error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [lookupIngredient, searchMode]); // Added searchMode dependency

  useEffect(() => {
    const handler = setTimeout(() => {
      searchIngredients(componentSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [componentSearchQuery, searchIngredients]);

  // --- Effects ---
  useEffect(() => {
    // Screen is loading if base data is loading, or editing data is loading
    const isLoading = loadingSections || loadingUnits || loadingComponents || (isEditing && (loadingDish || loadingPrep));
    setIsScreenLoading(isLoading);
  }, [loadingSections, loadingUnits, loadingComponents, isEditing, loadingDish, loadingPrep]);

  // Effect to populate form when editing data is loaded
  useEffect(() => {
    // Only run if editing and done loading
    if (!isEditing || isScreenLoading) {
      appLogger.log("--- useEffect [Editing Form Populate] skipped (guard) ---");

      return;
    }

    if (dishIdToEdit && dishToEdit) {
      appLogger.log("[Edit Mode] Populating form for editing dish:", dishToEdit.dish_name);
      setDishName(dishToEdit.dish_name || '');
      setMenuSectionId(dishToEdit.menu_section?.menu_section_id || null);
      setDirections(dishToEdit.directions?.split('\n') || ['']);
      const timeParts = dishToEdit.total_time?.split(':') || ['0', '30'];
      setTotalTimeHours(String(parseInt(timeParts[0]) || 0));
      setTotalTimeMinutes(String(parseInt(timeParts[1]) || 0));
      setServingSize(String(dishToEdit.serving_size || 1));
      setServingUnitId(null);
      const initialDishServings = (dishToEdit as any).num_servings ?? 1;
      setNumServings(initialDishServings);
      setOriginalServings(initialDishServings);
      setCookingNotes(dishToEdit.cooking_notes || '');
      setServingItem((dishToEdit as any).serving_item || '');

      const loadDishComponents = async () => {
        const componentPromises = dishToEdit.components.map(async (comp, index) => {
          const baseComponentInput: Omit<ComponentInput, 'originalPrep' | 'subIngredients'> = {
            key: `loaded-${comp.ingredient_id}-${index}`,
            ingredient_id: comp.ingredient_id,
            name: comp.name || t('common.unknownComponent'),
            amount: String(comp.amount || ''),
            unit_id: comp.unit?.unit_id || null,
            isPreparation: comp.isPreparation || false,
            item: comp.item || null,
          };

          if (comp.isPreparation) {
            try {
              // comp.ingredient_id is the preparation_id when comp.isPreparation is true
              const prepDetails = await fetchPreparationDetailsFromDB(comp.ingredient_id);
              if (prepDetails.preparation) {
                return {
                  ...baseComponentInput,
                  originalPrep: prepDetails.preparation,
                  subIngredients: prepDetails.ingredients,
                } as ComponentInput;
              } else {
                appLogger.warn(`[Edit Mode] Could not fetch details for preparation ${comp.ingredient_id}.`);
                return { ...baseComponentInput, originalPrep: null, subIngredients: [] } as ComponentInput;
              }
            } catch (error) {
              appLogger.error(`[Edit Mode] Error fetching details for preparation ${comp.ingredient_id}:`, error);
              return { ...baseComponentInput, originalPrep: null, subIngredients: [] } as ComponentInput;
            }
          }
          return baseComponentInput as ComponentInput;
        });

        const resolvedComponents = await Promise.all(componentPromises);
        setComponents(resolvedComponents);
        appLogger.log("[Edit Mode] Populated components from dishToEdit including preparation details.");
      };

      loadDishComponents();

    } else if (preparationIdToEdit && prepToEdit) {
      appLogger.log("[Edit Mode] Populating form for editing preparation:", prepToEdit.name);
      setDishName(prepToEdit.name || ''); // Use dishName state for prep name
      setMenuSectionId(null); // Preparations don't have menu sections

      setDirections(prepToEdit.directions?.split('\n') || ['']);

      // Populate time (prep hook might return total_time differently, adapt as needed)
      const prepTimeMinutes = prepToEdit.total_time || 30;
      setTotalTimeHours('0'); // Assuming prep time is only minutes
      setTotalTimeMinutes(String(prepTimeMinutes));

      // Preparations now unitless; default serving size 1
      setServingSize('1');
      setServingUnitId(null);

      setCookingNotes(prepToEdit.cooking_notes || '');

      // Populate components (ingredients of the preparation) including 'item'
      const loadedComponents: ComponentInput[] = prepComponentsToEdit.map((comp: any, index) => ({
        key: `loaded-prep-${comp.ingredient_id}-${index}`, // Generate a unique key
        ingredient_id: (comp as any).ingredient_id,
        name: comp.name || t('common.unknownIngredient'),
        amount: String(comp.amount || ''),
        unit_id: comp.unit?.unit_id || null,
        isPreparation: false, // Ingredients within a prep are not themselves preps in this context
        item: (comp as any).item || null, // Ensure item is mapped (adjust type if needed)
      }));
      setComponents(loadedComponents);
    }

    appLogger.log("--- useEffect [Editing Form Populate] body completed ---");

  }, [
    isEditing,
    isScreenLoading,
    dishIdToEdit,
    dishToEdit,
    preparationIdToEdit,
    prepToEdit,
    prepComponentsToEdit,
    t
  ]);

  // Add a separate effect to log the final state after update
  useEffect(() => {
    if (isEditing) {
      appLogger.log("[Edit Mode] Final 'components' state:", JSON.stringify(components, null, 2));
    }
  }, [
    // components, 
    isEditing
  ]);

  // --- Effect to populate top-level form fields from parsed recipe data --- 
  useEffect(() => {
    // Only run if confirming (coming from parser) and units are loaded
    if (!isConfirming || loadingUnits || !parsedRecipe) return;

    appLogger.log("[Effect] Populating top-level form fields from parsed recipe:", parsedRecipe);

    // Set top-level fields
    setDishName(parsedRecipe.recipe_name || '');
    setDirections(parsedRecipe.instructions || ['']);
    setNumServings(parsedRecipe.num_servings || 1);
    setOriginalServings(parsedRecipe.num_servings || 1); // Set base for scaling
    setServingSize(String(parsedRecipe.serving_size || 1));
    setCookingNotes(parsedRecipe.cook_notes || '');
    // Assuming total_time from parser is in minutes
    const parsedMinutes = parsedRecipe.total_time || 30;
    setTotalTimeHours(String(Math.floor(parsedMinutes / 60)));
    setTotalTimeMinutes(String(parsedMinutes % 60));
    setServingItem(parsedRecipe.serving_item || '');

    // Match the top-level serving unit
    const unitsMap = new Map<string, string>();
    units.forEach((u: Unit) => {
      if (u.unit_name) unitsMap.set(u.unit_name.toLowerCase(), u.unit_id);
      if (u.abbreviation) unitsMap.set(u.abbreviation.toLowerCase(), u.unit_id);
    });
    const parsedServingUnit = parsedRecipe.serving_unit?.toLowerCase().trim();
    let matchedServingUnitId: string | null = null;
    if (parsedServingUnit && unitsMap.has(parsedServingUnit)) {
      matchedServingUnitId = unitsMap.get(parsedServingUnit) || null;
      setServingUnitId(matchedServingUnitId);
      appLogger.log(`  Matched serving unit: '${parsedServingUnit}' -> ID: ${matchedServingUnitId}`);
    } else if (parsedServingUnit) {
      appLogger.warn(`  Parsed serving unit "${parsedRecipe.serving_unit}" not found in units map.`);
      // Set default serving unit if not matched
      const defaultUnit = units.find((u: Unit) => u.unit_name.toLowerCase() === 'serving') || units[0];
      setServingUnitId(defaultUnit?.unit_id || null);
      appLogger.log(`  Set default serving unit ID: ${defaultUnit?.unit_id}`);
    } else if (units.length > 0) {
      // Set default if no unit was parsed at all
      const defaultUnit = units.find((u: Unit) => u.unit_name.toLowerCase() === 'serving') || units[0];
      setServingUnitId(defaultUnit?.unit_id || null);
      appLogger.log(`  No serving unit parsed. Set default serving unit ID: ${defaultUnit?.unit_id}`);
    }

  }, [isConfirming, loadingUnits, parsedRecipe, units, t]); // Added units and t to dependencies
  // --- END Effect ---

  // --- Handlers (Placeholder/Basic Structure) --- 

  // handleAddComponent to handle different modes and navigation
  const handleAddComponent = async (selectedItem: any) => {
    const item_id = selectedItem?.ingredient_id || '';
    const name = selectedItem?.name || '';
    const trimmedName = name.trim();

    if (!trimmedName) {
      appLogger.error('Cannot add component: Missing name', selectedItem);
      Alert.alert(t('common.error'), t('alerts.errorAddComponentMissingName'));
      return;
    }

    setComponentSearchModalVisible(false); // Close modal immediately
    setComponentSearchQuery('');

    if (searchMode === 'ingredient') {
      // --- Ingredient Flow --- 
      if (item_id) {
        // Add existing ingredient directly
        addComponentWithDetails(item_id, trimmedName, false, true);
      } else {
        // No ID provided (user wants to create a new ingredient)
        try {
          const result = await resolveIngredient(trimmedName, t);
          if (result.mode === 'existing' && result.id) {
            addComponentWithDetails(result.id, trimmedName, false, true);
          } else if (result.mode === 'new') {
            // Create and add new raw ingredient
            const newIngId = await createNewIngredient(trimmedName);
            if (newIngId) {
              addComponentWithDetails(newIngId, trimmedName, false, false);
            }
          } // Handle cancel/error if necessary
        } catch (error) {
          appLogger.error(`Error resolving/creating ingredient "${trimmedName}":`, error);
          Alert.alert(t('common.error'), t('alerts.errorCheckingDuplicates'));
        }
      }
    } else { // searchMode === 'preparation'
      // --- Preparation Flow --- 
      if (item_id) {
        // Add existing preparation directly
        // addComponentWithDetails(item_id, trimmedName, true, true);
        appLogger.log("[handleAddComponent] Fetching preparation details for ID:", item_id);
        try {
          const { preparation, ingredients } = await fetchPreparationDetailsFromDB(item_id);

          appLogger.log(`--- fetchPreparationDetailsFromDB:`, preparation, ingredients);

          if (preparation && ingredients) {
            const newComponentData: ComponentInput = {
              key: `prep-${item_id}-${Date.now()}`,
              ingredient_id: item_id,
              name: trimmedName,
              isPreparation: true,
              amount: '',
              unit_id: PREPARATION_UNIT_ID, // Preparations as components use PREPARATION_UNIT_ID
              originalPrep: preparation as any,
              subIngredients: ingredients.map(ing => ({
                name: ing.name,
                ingredient_id: ing.ingredient_id,
                amount: typeof ing.amount === 'string' ? parseFloat(ing.amount) || null : ing.amount || null,
                unit_id: ing.unit?.unit_id || null,
                unit: ing.unit?.unit_id || null,
                isPreparation: ing.isPreparation,
              })),
              prepStateEditableIngredients: ingredients.map(ing => ({
                key: `prep-ing-${ing.ingredient_id}-${Date.now()}`,
                ingredient_id: ing.ingredient_id,
                name: ing.name,
                amountStr: String(ing.amount ?? ''),
                unitId: ing.unit?.unit_id || null,
                isPreparation: ing.isPreparation,
                unit: ing.unit?.unit_name || '',
                item: null,
                matched: true,
              })),
              prepStatePrepUnitId: null,
              prepStateInstructions: preparation.directions ? [preparation.directions] : null,
              prepStateIsDirty: false,
            };

            setComponents(prev => [...prev, newComponentData]);
          } else {
            appLogger.warn('Failed to fetch details for preparation:', trimmedName);
            Alert.alert(t('common.error'), t('alerts.errorFetchingPrepDetails'));
          }
        } catch (error) {
          appLogger.error('Error fetching preparation details:', error);
          Alert.alert(t('common.error'), t('alerts.errorFetchingPrepDetails'));
        }
      } else {
        // No ID provided (user wants to create a new preparation)
        // Navigate to CreatePreparationScreen
        appLogger.log(`Navigating to CreatePreparationScreen to create new prep: ${trimmedName}`);
        navigation.navigate('CreatePreparation', {
          preparation: { // Pass minimal data for a new prep
            name: trimmedName,
            // No components, yield, etc. initially
          } as ParsedIngredient,
          onNewPreparationCreated: handleNewPreparationCreated, // Pass the callback
        });
      }
    }
  };

  // Helper function to add the component with given details (Unchanged)
  function addComponentWithDetails(id: string, name: string, isPrep: boolean, matched: boolean, baseYield: number | null = null, baseYieldUnitId: string | null = null) {
    setComponents(prev => [
      ...prev,
      {
        key: `component-${id || 'new'}-${Date.now()}`,
        ingredient_id: id,
        name: name,
        amount: '',
        unit_id: null,
        isPreparation: isPrep,
        matched: matched,
      }
    ]);
  }

  // Callback handler for when a new preparation is created via CreatePreparationScreen
  const handleNewPreparationCreated: OnNewPreparationCreatedCallback = useCallback((newPrepData) => {
    appLogger.log('New preparation created, adding to dish components:', newPrepData);
    addComponentWithDetails(
      newPrepData.id,
      newPrepData.name,
      true, // It's a preparation
      false, // It's newly created, not matched initially
    );
    // Optionally set default amount/unit based on returned yield?
    // For now, just adds it with empty amount/unit
  }, [addComponentWithDetails]); // Include dependencies if needed

  const handleComponentUpdate = (key: string, field: 'amount' | 'amountStr' | 'unitId' | 'item' | 'scaledAmountStr' | 'unit_id', value: string | null) => {
    setComponents(prevComponents =>
      prevComponents.map(component => {
        appLogger.log(`--- CreateDishScreen/handleComponentUpdate:`, key, field, value, 'Current Component:', component);

        if (component.key === key) {
          const updatedComponent = { ...component };
          if (field === 'unitId') {
            updatedComponent.unit_id = value;
            if (updatedComponent.isPreparation) {
              (updatedComponent as any).prepStatePrepUnitId = value;
            }
          } else if (field === 'amount') {
            updatedComponent.amount = value === null ? "" : value;
          } else if (field === 'item') {
            updatedComponent.item = value;
          }
          appLogger.log('--- handleComponentUpdate: updated component:', updatedComponent);
          return updatedComponent;
        }
        return component;
      })
    );
  };

  const handleRemoveComponent = (key: string) => {
    setComponents(prev => prev.filter(c => c.key !== key));
  };

  // Handler to open category modal
  const openCategorySelector = () => {
    setCategoryModalVisible(true);
  };

  // Handler to select a category
  const handleCategorySelect = (section: MenuSection) => {
    setMenuSectionId(section.menu_section_id);
    setCategoryModalVisible(false);
  };

  // Handler to open serving unit modal
  const openServingUnitSelector = () => {
    setServingUnitModalVisible(true);
  };

  // Handler to select serving unit
  const handleServingUnitSelect = (unit: Unit) => {
    setServingUnitId(unit.unit_id);
    setServingUnitModalVisible(false);
  };

  // --- Handlers for Directions List ---
  const handleDirectionChange = (index: number, text: string) => {
    const newDirections = [...directions];
    newDirections[index] = text;
    setDirections(newDirections);
  };

  const handleAddDirectionStep = () => {
    setDirections([...directions, '']);
  };

  const handleRemoveDirectionStep = (index: number) => {
    if (directions.length <= 1) return; // Prevent removing the last step
    const newDirections = directions.filter((_, i) => i !== index);
    setDirections(newDirections);
  };

  // handleSaveDish - Check prepStateIsDirty
  const handleSaveDish = async () => {
    appLogger.log("--- handleSaveDish called ---");
    appLogger.log("Current components state:", JSON.stringify(components, null, 2)); // Log initial components

    // --- Basic Validations --- //
    const trimmedDishName = dishName.trim();
    if (!trimmedDishName) {
      Alert.alert(t('common.error'), t('alerts.errorMissingDishName'));
      return;
    }

    // Ensure at least one component is added
    if (components.length === 0) {
      Alert.alert(t('common.error'), t('alerts.addOneComponent'));
      return;
    }

    // Validate component amounts and units
    for (const comp of components) {
      const amountNum = parseFloat(comp.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        Alert.alert(t('alerts.invalidComponentTitle'), t('alerts.invalidComponentMessage', { name: comp.name }));
        return;
      }
      if (!comp.unit_id) {
        Alert.alert(t('alerts.invalidComponentTitle'), t('alerts.invalidComponentMessage', { name: comp.name }));
        return;
      }
    }

    // Validate time inputs
    const hours = parseInt(totalTimeHours, 10);
    const minutes = parseInt(totalTimeMinutes, 10);
    if (isNaN(hours) || hours < 0 || isNaN(minutes) || minutes < 0 || minutes > 59) {
      Alert.alert(t('alerts.invalidTimeTitle'), t('alerts.invalidTimeMessage'));
      return;
    }
    const totalMinutes = hours * 60 + minutes;

    setSubmitting(true);
    appLogger.log("Submitting state set to true");

    let targetDishId = dishIdToEdit;
    let operationType: 'create' | 'update' = dishIdToEdit ? 'update' : 'create';

    try {
      appLogger.log(`Operation type: ${operationType}`);
      // --- Resolve Dish Name (Create/Update Check) --- //
      if (!targetDishId) { // Only resolve if creating a new dish
        // --- Pass t function, not activeKitchenId ---
        const resolveResult = await resolveDish(trimmedDishName, t);
        appLogger.log("Dish resolve result:", resolveResult);
        if (resolveResult.mode === 'existing' && resolveResult.id) {
          // This handles the theoretical 'existing' mode (currently unused by resolveDish)
          targetDishId = resolveResult.id;
          operationType = 'update';
          appLogger.log(`Resolved to existing dish ID: ${targetDishId}, switching to update.`);
        } else if (resolveResult.mode === 'overwrite' && resolveResult.id) {
          // Explicitly handle 'overwrite' mode
          targetDishId = resolveResult.id;
          operationType = 'update';
          appLogger.log(`Resolved to overwrite existing dish ID: ${targetDishId}, switching to update.`);
        } else if (resolveResult.mode === 'cancel') {
          appLogger.log("Dish save cancelled by user.");
          setSubmitting(false);
          return; // User cancelled
        }
        // If mode is 'new', proceed with creation (targetDishId remains null)
      }

      // --- Process Components (Resolve Ingredients/Preps) --- //
      appLogger.log("Processing components...");
      const processedDishComponents: Database['public']['Tables']['dish_components']['Insert'][] = [];
      const createdPreparationIds = new Map<string, string>(); // Store newly created prep IDs (key -> db_id)
      for (const component of components) {
        appLogger.log(`Processing component: ${component.name} (key: ${component.key})`);
        let ingredientId: string | null = component.ingredient_id || null;
        // Use component.ingredient_id if component.isPreparation is true and ID exists
        let preparationId: string | null = (component.isPreparation && component.ingredient_id) ? component.ingredient_id : null;

        // --- Resolve Ingredient/Preparation ID --- //
        if (component.isPreparation) {
          // --- Handling Preparations --- //
          if (!preparationId && component.key && createdPreparationIds.has(component.key)) {
            // If it's a prep we just created in this save operation, use its new ID
            preparationId = createdPreparationIds.get(component.key)!;
            ingredientId = preparationId; // Update ingredientId as well
            appLogger.log(`Using newly created preparation ID for ${component.name}: ${preparationId}`);
          } else if (!preparationId) {
            // It's a preparation, but we don't have its ID yet.
            // This could be an *existing* prep selected by the user, or a *new* prep defined within this dish.

            // Check if it's a *new* preparation defined during parsing/editing
            // NOTE: Heuristic: Lacks an ingredient_id AND has sub-components defined
            const isNewlyDefinedPrep = !component.ingredient_id &&
              component.prepStateEditableIngredients &&
              component.prepStateEditableIngredients.length > 0;

            if (isNewlyDefinedPrep) {
              appLogger.log(`Component ${component.name} identified as a newly defined preparation.`);
              // --- >>> NEW: Resolve sub-components for the NEW preparation <<< ---
              const resolvedSubComponentsInput: ComponentInput[] = []; // Store as ComponentInput for createNewPrep
              let subResolutionFailed = false;
              appLogger.log(`Resolving sub-components for new prep: ${component.name}`);
              for (const subComp of component.prepStateEditableIngredients!) {
                appLogger.log(`  Resolving sub-component: ${subComp.name}`);
                let resolvedSubId: string | null = null; // Holds Ingredient ID
                let resolvedSubPrepId: string | null = null; // Holds Preparation ID

                if (subComp.isPreparation) {
                  // If the sub-component is itself a preparation, resolve it using resolvePreparation
                  appLogger.warn(`Attempting to resolve sub-preparation: ${subComp.name}`);
                  // Assume existing sub-preparations must be resolved by name.
                  // Fingerprint/ParentDishName are null as we don't have that context here.
                  const prepResolveResult = await resolvePreparation(subComp.name.trim(), null, null, t);
                  if (prepResolveResult.mode === 'existing' && prepResolveResult.id) {
                    resolvedSubPrepId = prepResolveResult.id;
                    appLogger.log(`    Resolved sub-preparation ${subComp.name} to ID: ${resolvedSubPrepId}`);
                  } else {
                    appLogger.error(`Could not resolve existing sub-preparation '${subComp.name}' needed for new preparation '${component.name}'. Mode: ${prepResolveResult.mode}`);
                    subResolutionFailed = true;
                    break; // Stop processing sub-components for this prep
                  }
                } else {
                  // If the sub-component is an ingredient, resolve it using resolveIngredient
                  const ingResolveResult = await resolveIngredient(subComp.name.trim(), t);

                  // Handle different resolution modes - Trust resolver to return ID if successful
                  if ((ingResolveResult.mode === 'existing' || ingResolveResult.mode === 'new') && ingResolveResult.id) {
                    resolvedSubId = ingResolveResult.id;
                    appLogger.log(`    Resolved sub-ingredient ${subComp.name} to ID: ${resolvedSubId} (Mode: ${ingResolveResult.mode})`);
                  } else {
                    // If no ID was returned (includes cancel or unexpected errors), fail resolution
                    appLogger.error(`    Failed to resolve sub-ingredient ${subComp.name}. Mode: ${ingResolveResult.mode}, ID: ${ingResolveResult.id}`);
                    subResolutionFailed = true;
                    break; // Stop processing sub-components for this prep
                  }
                }

                // Use the appropriate ID based on whether it was resolved as a prep or ingredient
                const finalSubId = resolvedSubPrepId ?? resolvedSubId;

                if (!finalSubId) {
                  appLogger.error(`    Sub-component ${subComp.name} could not be resolved to an ID.`);
                  subResolutionFailed = true;
                  break; // Stop processing sub-components for this prep
                }

                // Convert EditablePrepIngredient to ComponentInput for createNewPreparation
                // Use amountStr directly as the 'amount' field (which is string) in ComponentInput
                const subAmountStr = subComp.amountStr || '0'; // Default to '0' if empty/null
                if (isNaN(parseFloat(subAmountStr))) {
                  appLogger.error(`    Sub-component ${subComp.name} has invalid amount: ${subComp.amountStr}`);
                  subResolutionFailed = true;
                  break;
                }

                resolvedSubComponentsInput.push({
                  key: `newprep-sub-${subComp.key}`, // Unique key for this context
                  name: subComp.name,
                  ingredient_id: finalSubId, // ID of the resolved ingredient or preparation
                  amount: subAmountStr, // Use string amount
                  unit_id: subComp.unitId, // Pass unitId directly
                  isPreparation: !!resolvedSubPrepId, // True if resolvedSubPrepId is set
                  item: subComp.item,
                  matched: true // Assumed matched since we resolved it
                });
              }

              if (subResolutionFailed) {
                appLogger.error(`Failed to resolve sub-components for new preparation '${component.name}'. Aborting dish save.`);
                Alert.alert(t('common.error'), t('alerts.errorPrepInvalidSubComponents', { name: component.name }));
                setSubmitting(false);
                return;
              }

              // --- Resolve the preparation itself using the resolver ---
              appLogger.log(`Resolving main preparation: ${component.name}`);
              // Calculate fingerprint *before* resolving, as it might be needed if creating new
              // NOTE: Fingerprint calculation might need adjustment if sub-component IDs weren't final before
              const prepFingerprint = fingerprintPreparation(
                resolvedSubComponentsInput, // Pass components array directly
                component.prepStateInstructions || [] // Pass directions directly
              );
              appLogger.log(`  Calculated Fingerprint: ${prepFingerprint}`);

              const resolveResult = await resolvePreparation(component.name.trim(), prepFingerprint, trimmedDishName, t);
              appLogger.log(`  Main prep resolve result: ${JSON.stringify(resolveResult)}`);

              if (resolveResult.mode === 'existing' || resolveResult.mode === 'overwrite') {
                // Preparation already exists or user chose to overwrite.
                preparationId = resolveResult.id!;
                ingredientId = preparationId; // Update ingredientId as well
                appLogger.log(`  Resolved ${component.name} to existing prep ID: ${preparationId} (Mode: ${resolveResult.mode})`);

                // If components were modified locally OR user chose overwrite, we need to update.
                if (component.prepStateIsDirty || resolveResult.mode === 'overwrite') {
                  appLogger.log(`  Preparation ${component.name} needs update (Dirty: ${component.prepStateIsDirty}, Mode: ${resolveResult.mode}).`);
                  // TODO: Call updatePreparationDetails(preparationId, resolvedSubComponentsInput, component.prepStateInstructions, ... other details ...);
                  appLogger.warn(`  UPDATE LOGIC PENDING for dirty/overwrite prep: ${component.name}`);
                }
              } else if (resolveResult.mode === 'new' || resolveResult.mode === 'rename') {
                // User confirmed creation (either with original name or renamed).
                const nameToCreate = resolveResult.mode === 'rename' ? resolveResult.newName! : component.name.trim();
                appLogger.log(`  User confirmed creation of preparation: ${nameToCreate}`);

                // Calculate total minutes from top-level state
                const prepTotalMinutes = (parseInt(totalTimeHours, 10) || 0) * 60 + (parseInt(totalTimeMinutes, 10) || 0);
                // Parse yield amount from top-level state
                const prepYieldAmount = null;
                // Get yield unit from component state
                const prepYieldUnitId = null;

                appLogger.log(`  [handleSaveDish] Pre-createNewPreparation Log for: ${nameToCreate}`);
                appLogger.log(`    Component State (Key ${component.key}):`, JSON.stringify(component, null, 2));
                appLogger.log(`    Calculated prepTotalMinutes: ${prepTotalMinutes}`);
                appLogger.log(`    Calculated prepYieldAmount: ${prepYieldAmount}`);
                appLogger.log(`    Using prepYieldUnitId: ${prepYieldUnitId}`);

                const newPrepId = await createNewPreparation(
                  nameToCreate,
                  prepFingerprint, // Pass calculated fingerprint
                  null, // _componentDetails is unused
                  {
                    components: resolvedSubComponentsInput,
                    directions: component.prepStateInstructions || [],
                    yieldUnitId: null, // Use the variable captured above
                    // Pass parsed top-level yield amount, default to 1 if NaN
                    yieldAmount: null,
                    // Pass calculated total minutes, default to null if 0
                    totalTimeMinutes: prepTotalMinutes > 0 ? prepTotalMinutes : null,
                    // TODO: Decide where cooking notes for a new sub-prep should come from. Defaulting to null.
                    cookingNotes: null,
                  }
                );

                if (newPrepId) {
                  preparationId = newPrepId;
                  ingredientId = newPrepId; // Update ingredientId as well
                  createdPreparationIds.set(component.key, newPrepId); // Track created ID by component key
                  appLogger.log(`  Successfully created preparation '${nameToCreate}' with ID: ${preparationId}`);
                } else {
                  appLogger.error(`  Failed to create the preparation '${nameToCreate}'. Aborting dish save.`);
                  Alert.alert(t('common.error'), t('alerts.errorCreatePreparationFailed', { name: nameToCreate }));
                  setSubmitting(false);
                  return;
                }
              } else if (resolveResult.mode === 'cancel') {
                // User cancelled the save during preparation resolution
                appLogger.log(`Save cancelled by user during resolution of ${component.name}.`);
                setSubmitting(false);
                return;
              } else {
                // Handle unexpected error from resolvePreparation
                appLogger.error(`Could not resolve preparation '${component.name}' due to unexpected resolver state: ${resolveResult.mode}.`);
                Alert.alert(t('common.error'), t('alerts.errorResolvePrepFailed', { name: component.name }));
                setSubmitting(false);
                return;
              }
          

            }
          }
          // --- End Handling Preparations --- //
        } else {
          // --- Handling Ingredients --- //
          if (!ingredientId) {
            appLogger.log(`Resolving ingredient: ${component.name}`);
            const resolveResult = await resolveIngredient(component.name.trim(), t);
            appLogger.log(`  Resolve result: ${JSON.stringify(resolveResult)}`);
            if ((resolveResult.mode === 'existing' || resolveResult.mode === 'new') && resolveResult.id) {
              ingredientId = resolveResult.id;
              appLogger.log(`  Resolved to ingredient ID: ${ingredientId}`);
            } else if (resolveResult.mode === 'cancel') {
              appLogger.log("Ingredient resolution cancelled by user.");
              setSubmitting(false);
              return; // User cancelled
            } else {
              appLogger.error(`Failed to resolve ingredient '${component.name}'. Resolver mode: ${resolveResult.mode}`);
              Alert.alert(t('common.error'), t('alerts.errorResolveIngredientFailed', { name: component.name }));
              setSubmitting(false);
              return;
            }
          }
          // --- End Handling Ingredients --- //
        }

        // --- Validate Resolved IDs and Add to Processed List --- //
        // ID now stored consistently in ingredientId for both ingredients and preps
        if (!ingredientId) {
          appLogger.error(`Component '${component.name}' could not be resolved to an ID.`);
          Alert.alert(t('common.error'), t('alerts.errorProcessingComponentFailed', { name: component.name }));
          setSubmitting(false);
          return;
        }

        // --- Update Existing Preparation Details if applicable <<< ---
        if (component.isPreparation && component.ingredient_id && component.originalPrep) {
          // This is an existing preparation that came from the parser.
          // Update its details based on parsed information.
          appLogger.log(`Updating existing preparation details for: ${component.name} (ID: ${component.ingredient_id})`);

          // 1. Update Preparation Time
          const parsedPrepTime = (component.originalPrep as any)?.total_time;
          if (parsedPrepTime != null) { // Check if parser provided time
            const { error: prepUpdateError } = await supabase
              .from('preparations')
              .update({ total_time: parsedPrepTime })
              .eq('preparation_id', component.ingredient_id);
            if (prepUpdateError) {
              appLogger.error(`Error updating preparation time for ${component.name}:`, prepUpdateError);
              // Decide if this is critical - maybe just warn?
            } else {
              appLogger.log(`  Updated preparation total_time to: ${parsedPrepTime}`);
            }
          }

          // 2. Update Ingredient Yield (amount/unit in ingredients table)
          // Use the unit ID matched during pre-processing (stored in component.unit_id)
          // Use the amount parsed for the prep component itself (stored in component.originalPrep.amount)
          const parsedYieldAmount = null;

          if (parsedYieldAmount != null) {
            const { error: ingredientUpdateError } = await supabase
              .from('ingredients')
              .update({ amount: parsedYieldAmount, unit_id: undefined })
              .eq('ingredient_id', component.ingredient_id); // Use prep ID = ingredient ID
            if (ingredientUpdateError) {
              appLogger.error(`Error updating ingredient yield for ${component.name}:`, ingredientUpdateError);
              // Decide if this is critical - maybe just warn?
            } else {
              appLogger.log(`  Updated ingredient yield to: ${parsedYieldAmount} (Unit: ${undefined})`);
            }
          }

          // 3. (Future Improvement) Update Preparation Ingredients
          // We could potentially delete/re-insert preparation_components here
          // using component.prepStateEditableIngredients, ensuring the 'cauliflower'
          // entry with ingredient_id=null is handled correctly (skipped or resolved).
          // For now, we'll skip this to avoid complexity and focus on time/yield.
          // The existing bad entry might remain until manually fixed or a dedicated prep update function is built.
          appLogger.log(`  Skipping update of sub-ingredients for existing prep ${component.name} in this flow.`);

        }
        // --- >>> END: Update Existing Preparation Details <<< ---

        const amountNum = parseFloat(component.amount);
        const dishComponentInsert: Database['public']['Tables']['dish_components']['Insert'] = {
          dish_id: '', // Will be set later
          ingredient_id: ingredientId, // Must be non-null string (holds prep ID too)
          // preparation_id field does not exist in dish_components table
          amount: isNaN(amountNum) ? null : amountNum,
          unit_id: component.unit_id ?? undefined, // Use undefined if null
        };
        processedDishComponents.push(dishComponentInsert);
        appLogger.log(`Added processed component to list: ${JSON.stringify(dishComponentInsert)}`);

      } // End for loop processing components

      appLogger.log("Component processing finished.");
      appLogger.log("Processed dish components:", JSON.stringify(processedDishComponents, null, 2));

      // --- Upsert Dish --- //
      const formattedDirectionsStr = directions.map(d => d.trim()).filter(Boolean).join('\n'); // Format directions
      const servingSizeNum = parseFloat(servingSize);

      // Add validation for required serving_unit_id
      if (!servingUnitId) {
        Alert.alert(t('common.error'), t('alerts.selectServingUnit'));
        setSubmitting(false);
        return;
      }

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const formattedHours = String(hours).padStart(2, '0');
      const formattedMinutes = String(minutes).padStart(2, '0');
      const totalTimeIntervalString = `${formattedHours}:${formattedMinutes}:00`;

      const dishUpsertData: Database['public']['Tables']['dishes']['Insert'] = {
        dish_name: trimmedDishName,
        kitchen_id: activeKitchenId!,
        cooking_notes: cookingNotes || null,  // Changed from 'description'
        menu_section_id: menuSectionId ?? undefined,
        // total_time: totalMinutes || null,
        total_time: totalTimeIntervalString,
        serving_size: isNaN(servingSizeNum) ? undefined : servingSizeNum,
        serving_unit_id: servingUnitId,
        num_servings: numServings || null,    // Changed from 'servings'
        directions: formattedDirectionsStr || null,
      };

      let savedDishId: string;

      if (operationType === 'update' && targetDishId) {
        appLogger.log(`Updating existing dish ID: ${targetDishId}`);
        const { data: updateData, error: updateError } = await supabase
          .from('dishes')
          .update(dishUpsertData)
          .eq('dish_id', targetDishId)
          .select('dish_id')
          .single();

        if (updateError) throw updateError;
        if (!updateData?.dish_id) throw new Error("Failed to get dish ID after update.");
        savedDishId = updateData.dish_id;
        appLogger.log(`Dish ${savedDishId} updated successfully.`);

        // --- Update Components (Delete existing and insert new) --- //
        appLogger.log(`Deleting existing components for dish ${savedDishId}`);
        const { error: deleteError } = await supabase
          .from('dish_components')
          .delete()
          .eq('dish_id', savedDishId);
        if (deleteError) {
          appLogger.error("Error deleting existing dish components:", deleteError);
          // Decide if this is critical - maybe warn user?
        }

      } else {
        appLogger.log("Creating new dish...");
        const { data: insertData, error: insertError } = await supabase
          .from('dishes')
          .insert(dishUpsertData)
          .select('dish_id')
          .single();

        if (insertError) throw insertError;
        if (!insertData?.dish_id) throw new Error("Failed to get dish ID after insert.");
        savedDishId = insertData.dish_id;
        appLogger.log(`New dish created with ID: ${savedDishId}`);
      }

      // --- Insert Dish Components --- //
      if (processedDishComponents.length > 0) {
        appLogger.log(`Inserting ${processedDishComponents.length} dish components for dish ${savedDishId}...`);
        const componentsToInsert = processedDishComponents.map(comp => ({ ...comp, dish_id: savedDishId }));
        const { error: componentError } = await supabase
          .from('dish_components')
          .insert(componentsToInsert);

        if (componentError) {
          appLogger.error("Error inserting dish components:", componentError);
          // Non-critical? Maybe warn user?
          Alert.alert(t('common.warning'), t('alerts.dishCreateWarnComponents'));
        } else {
          appLogger.log("Dish components inserted successfully.")
        }
      } else {
        appLogger.log("No dish components to insert.")
      }

      // --- Insert/Update Dish Directions --- //
      // REMOVED: Logic to interact with dish_directions table is removed.
      // Directions are now part of the main dishUpsertData.

      appLogger.log("--- Dish save process completed successfully ---");
      Alert.alert(t('common.success'), t('alerts.recipeSaveSuccessMessage', { recipeName: trimmedDishName }));

      // Refresh relevant data after successful save
      // Call refreshData without specific tables, passing kitchen ID
      if (activeKitchenId) {
        refreshData(activeKitchenId);
      } else {
        appLogger.warn("Cannot refresh data: Active kitchen ID is null.");
      }

      navigation.goBack();

    } catch (error: any) {
      appLogger.error("--- Error during handleSaveDish ---", error);
      Alert.alert(t('alerts.errorSavingRecipeTitle'), t('alerts.errorSaveRecipeMessage', { error: error.message || t('alerts.errorSavingRecipeDefault') }));
    } finally {
      appLogger.log("Setting submitting state to false");
      setSubmitting(false);
    }
  };

  // MODIFIED: savePrepLogic - Adapt to use ComponentInput state and handle updates
  // *** Ensure savePrepLogic is defined WITHIN CreateDishScreen component scope ***
  const savePrepLogic = async (existingPrepId?: string) => {
    if (!existingPrepId) {
      appLogger.error("Cannot update preparation: No preparation ID provided");
      return;
    }

    try {
      // Find the preparation data from components array
      const prepComponent = components.find(c => c.ingredient_id === existingPrepId);
      if (!prepComponent) {
        appLogger.error(`Preparation with ID ${existingPrepId} not found in components list`);
        return;
      }

      appLogger.log(`Updating preparation: ${prepComponent.name} (ID: ${existingPrepId})`);

      // Get updated directions
      const updatedDirections = prepComponent.prepStateInstructions || [];
      const finalDirectionsStr = updatedDirections.map(s => s.trim()).filter(Boolean).join('\n');

      // First, update the preparations table
      const { error: prepError } = await supabase
        .from('preparations')
        .update({
          directions: finalDirectionsStr,
          // You may need to update other fields like total_time if needed
        })
        .eq('preparation_id', existingPrepId);

      if (prepError) {
        appLogger.error(`Error updating preparation ${existingPrepId}:`, prepError);
        throw prepError;
      }

      // Next, update preparation_components if needed
      if (prepComponent.prepStateEditableIngredients?.length) {
        // First, delete existing preparation_components
        const { error: deleteError } = await supabase
          .from('preparation_components')
          .delete()
          .eq('preparation_id', existingPrepId);

        if (deleteError) {
          appLogger.error(`Error deleting preparation ingredients for ${existingPrepId}:`, deleteError);
          throw deleteError;
        }

        // Then insert new ones
        const validComponents = prepComponent.prepStateEditableIngredients
          .filter(epi => epi.ingredient_id && epi.unitId && !isNaN(parseFloat(epi.amountStr)))
          .map(epi => ({
            preparation_id: existingPrepId,
            ingredient_id: epi.ingredient_id!,
            amount: parseFloat(epi.amountStr) || 0,
            unit_id: epi.unitId!,
          }));

        if (validComponents.length) {
          const { error: insertError } = await supabase
            .from('preparation_components')
            .insert(validComponents);

          if (insertError) {
            appLogger.error(`Error inserting updated preparation ingredients for ${existingPrepId}:`, insertError);
            throw insertError;
          }
        }
      }

      appLogger.log(`Successfully updated preparation: ${prepComponent.name} (ID: ${existingPrepId})`);

      // Refresh preparation data after successful update
      // Pass only kitchenId for broader refresh
      if (kitchenId) { // Use kitchenId obtained earlier in the component
        refreshData(kitchenId); // Refresh related tables
      } else {
        appLogger.warn("Cannot refresh preparation data: kitchen ID is missing.");
      }

      return existingPrepId;
    } catch (error) {
      appLogger.error(`Error in savePrepLogic for ID ${existingPrepId}:`, error);
      Alert.alert(t('common.error'), t('alerts.errorUpdatingPreparation'));
      return null;
    }
  };

  const createNewPreparation = async (
    prepName: string,
    prepFingerprint: string | null,
    _componentDetails: any | null,
    options: {
      components: ComponentInput[];
      directions: string[];
      yieldUnitId: string | null;
      yieldAmount: number | null;
      totalTimeMinutes: number | null;
      cookingNotes: string | null
    }
  ): Promise<string | null> => {
    const trimmedPrepName = prepName.trim(); // Use a consistent trimmed name
    try {
      appLogger.log(`Creating new preparation DB entry: ${trimmedPrepName}`);

      if (!options.yieldUnitId) {
        appLogger.error(`Cannot create preparation '${prepName}': Missing yield unit ID.`);
        Alert.alert(t('common.error'), t('alerts.errorMissingPrepYieldUnit'));
        return null;
      }

      if (!activeKitchenId) {
        appLogger.error(`Cannot create preparation '${prepName}': No active kitchen selected.`);
        Alert.alert(t('common.error'), t('alerts.errorCreatingPreparationNoKitchen'));
        return null;
      }

      let newPreparationId: string | null = null;

      // --- NEW: Check if ingredient already exists by name --- //
      appLogger.log(`Checking if ingredient named "${trimmedPrepName}" already exists...`);
      const existingIngredientId = await checkIngredientNameExists(trimmedPrepName);

      if (existingIngredientId) {
        appLogger.log(`Ingredient "${trimmedPrepName}" already exists with ID: ${existingIngredientId}. Using this ID.`);
        newPreparationId = existingIngredientId;
        // Skip ingredient insert
      } else {
        appLogger.log(`Ingredient "${trimmedPrepName}" does not exist. Creating ingredient row...`);
        // --- Create the ingredient entry for the preparation --- //
        const ingredientInsert = {
          name: trimmedPrepName,
          cooking_notes: options.cookingNotes?.trim() || undefined,
          unit_id: options.yieldUnitId,
          amount: options.yieldAmount ?? 1,
          kitchen_id: activeKitchenId,
        };

        const { data: ingredientInsertData, error: ingredientError } = await supabase
          .from('ingredients')
          .insert(ingredientInsert)
          .select('ingredient_id')
          .single();

        if (ingredientError) {
          appLogger.error(`Error creating ingredient row for preparation '${trimmedPrepName}':`, ingredientError);
          // Don't re-throw immediately, handle below
        } else if (!ingredientInsertData?.ingredient_id) {
          appLogger.error("Failed to retrieve ID after inserting ingredient row for preparation.");
          // Treat as failure
        } else {
          newPreparationId = ingredientInsertData.ingredient_id;
          appLogger.log(`Successfully created ingredient row with ID: ${newPreparationId}`);
        }
      }
      // --- END: Ingredient row check/creation --- //

      // If we failed to get an ingredient ID (either existing or new), abort.
      if (!newPreparationId) {
        appLogger.error(`Failed to obtain an ingredient ID for preparation '${trimmedPrepName}'. Aborting.`);
        throw new Error(`Could not find or create an ingredient entry for ${trimmedPrepName}.`);
      }

      // --- Create the preparation entry --- //
      appLogger.log(`Inserting into preparations table with ID: ${newPreparationId}`);
      const finalDirectionsStr = options.directions.map(d => d.trim()).filter(Boolean).join('\n');
      const prepInsert = {
        preparation_id: newPreparationId,
        directions: finalDirectionsStr || undefined,
        total_time: options.totalTimeMinutes,
        fingerprint: prepFingerprint
      } as Database['public']['Tables']['preparations']['Insert'];

      const { error: prepError } = await supabase.from('preparations').insert(prepInsert);

      if (prepError) {
        appLogger.error(`Error creating preparation row for '${trimmedPrepName}' (ID: ${newPreparationId}):`, prepError);
        // If prep insert fails, we might have an orphaned ingredient row.
        // Consider adding cleanup logic here if necessary.
        throw prepError;
      }

      // --- Add preparation ingredients if provided --- //
      appLogger.log(`Adding sub-components for preparation ${trimmedPrepName}...`);
      if (options.components.length > 0) {
        const validComponents = options.components.filter(c =>
          c.ingredient_id && c.unit_id && !isNaN(parseFloat(c.amount))
        );

        if (validComponents.length !== options.components.length) {
          appLogger.warn(`Skipped ${options.components.length - validComponents.length} invalid components when creating preparation ${trimmedPrepName}`);
        }

        if (validComponents.length > 0) {
          const prepIngredientsInsert = validComponents.map(c => ({
            preparation_id: newPreparationId,
            ingredient_id: c.ingredient_id!,
            amount: parseFloat(c.amount) || 0,
            unit_id: c.unit_id!,
          }));

          const { error: prepIngErr } = await supabase.from('preparation_components').insert(prepIngredientsInsert);

          if (prepIngErr) {
            appLogger.error(`Error adding ingredients to preparation '${trimmedPrepName}':`, prepIngErr);
            throw prepIngErr;
          }
        }
      }

      appLogger.log(`Successfully created preparation '${trimmedPrepName}' with ID: ${newPreparationId}`);

      // Refresh relevant data after creating a new preparation
      if (activeKitchenId) {
        refreshData(activeKitchenId);
      } else {
        appLogger.warn("Cannot refresh data after prep creation: Active kitchen ID is null.");
      }

      return newPreparationId;
    } catch (error: any) { // Catch any error from the try block
      appLogger.error(`Error in createNewPreparation for ${trimmedPrepName}:`, error);
      Alert.alert(t('common.error'), t('alerts.errorCreatingPreparation', { name: trimmedPrepName, message: error.message }));
      return null;
    }
  };

  // --- Render Logic --- 
  if (isScreenLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" /></View>;
  }

  // Find names for selected category and unit for display
  const selectedCategoryName = menuSections.find(s => s.menu_section_id === menuSectionId)?.name || 'Select Category';
  const selectedServingUnitName = units.find(u => u.unit_id === servingUnitId)?.unit_name || 'Select Unit';

  // Filter components into ingredients and preparations for rendering
  const ingredientsList = components.filter(c => !c.isPreparation);

  const preparationsList = components.filter(c => c.isPreparation);

  // ADDED: Handler to open unit modal (passed to IngredientListComponent)
  const openComponentUnitSelector = (key: string, measureKind?: MeasureKind | null) => {
    setSelectedIngredientKey(key);
    setCurrentEditingItemMeasureKind(measureKind || null); // Store the measure kind
    setIngredientUnitModalVisible(true);
  };

  const openComponentSearchModal = (mode: 'ingredient' | 'preparation') => {
    setSearchMode(mode);
    setComponentSearchQuery('');
    setSearchResults([]);
    setComponentSearchModalVisible(true);
  };

  const openIngredientUnitModal = (key: string, measureKind?: MeasureKind | null) => {
    setSelectedIngredientKey(key);
    setCurrentEditingItemMeasureKind(measureKind || null); // Store the measure kind
    setIngredientUnitModalVisible(true);
  };

  const handleIngredientUnitSelect = (unit: Unit) => {
    if (selectedIngredientKey) {
      appLogger.log(`--- CreateDishScreen/handleIngredientUnitSelect/:`, unit);

      handleComponentUpdate(selectedIngredientKey, 'unitId', unit.unit_id);
      setIngredientUnitModalVisible(false);
      setSelectedIngredientKey(null);
    }
  };

  appLogger.log('--- CreateDishScreen: render components:', components);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      {/* Update Header Title Dynamically */}
      <AppHeader
        title={t(isEditing ? (dishIdToEdit ? 'screens.createRecipe.editDishTitle' : 'screens.createRecipe.editPreparationTitle') : (isConfirming ? 'screens.createRecipe.confirmParsedTitle' : 'screens.createRecipe.createTitle'))}
        showBackButton={true}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled" // Closes keyboard when tapping outside inputs
        >
          {/* Recipe Name Input */}
          <Text style={styles.label}>{t('screens.createRecipe.nameLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('screens.createRecipe.namePlaceholder')}
            placeholderTextColor={COLORS.placeholder}
            value={dishName}
            onChangeText={setDishName}
          />

          {/* --- Scale Slider --- */}
          {originalServings > 0 && ( // Only show slider if original servings are known
            <View style={styles.scalingSection}>
              <ScaleSliderInput
                label="Scale recipe to"
                minValue={1} // Minimum 1 serving
                maxValue={Math.max(10, Math.ceil(originalServings * 5))} // Sensible max
                step={1} // Step by whole servings
                currentValue={numServings} // Use target servings state
                displayValue={String(numServings)} // Display target servings
                displaySuffix="servings"
                onValueChange={(value) => {
                  const newServings = Math.round(value);
                  setNumServings(newServings);
                  
                  // Force update all preparation components with new scale
                  const newScale = newServings / originalServings;
                  components.forEach(comp => {
                    if (comp.isPreparation && comp.key) {
                      // Update each preparation with the new scale
                      handlePrepSaveChanges(comp.key, {
                        scaleMultiplier: newScale,
                        // Keep existing values
                        editableIngredients: comp.prepStateEditableIngredients ?? [],
                        prepUnitId: comp.prepStatePrepUnitId ?? null,
                        instructions: comp.prepStateInstructions ?? [],
                        isDirty: false // Don't mark as dirty for scale changes
                      });
                    }
                  });
                  appLogger.log(`[CreateDishScreen] Updated scale for all preparations to ${newScale}`);
                }}
                onSlidingComplete={(value) => {
                  // Same handler as onValueChange to ensure consistency
                  const newServings = Math.round(value);
                  setNumServings(newServings);
                  
                  // Force update all preparation components with new scale
                  const newScale = newServings / originalServings;
                  components.forEach(comp => {
                    if (comp.isPreparation && comp.key) {
                      // Update each preparation with the new scale
                      handlePrepSaveChanges(comp.key, {
                        scaleMultiplier: newScale,
                        // Keep existing values
                        editableIngredients: comp.prepStateEditableIngredients ?? [],
                        prepUnitId: comp.prepStatePrepUnitId ?? null,
                        instructions: comp.prepStateInstructions ?? [],
                        isDirty: false // Don't mark as dirty for scale changes
                      });
                    }
                  });
                  appLogger.log(`[CreateDishScreen] Finalized scale for all preparations to ${newScale}`);
                }}
                onTextInputChange={(text) => { // Handle direct text input for servings
                  const newServings = parseInt(text, 10);
                  if (!isNaN(newServings) && newServings >= 1) {
                    const maxSliderValue = Math.max(10, Math.ceil(originalServings * 5));
                    setNumServings(Math.min(newServings, maxSliderValue)); // Clamp
                  } else if (text === '') {
                    setNumServings(originalServings); // Reset to original if cleared
                  }
                }}
              />
            </View>
          )}

          {/* Display total quantity using base serving unit without yield abstraction */}
          {originalServings > 0 && typeof parseFloat(servingSize) === 'number' && servingUnitId && (
            (() => {
              const targetServings = numServings; // Already a number
              const servingSizeNum = parseFloat(servingSize);
              const totalYieldAmount = servingSizeNum * targetServings;
              const unitAbbr = units.find(u => u.unit_id === servingUnitId)?.abbreviation || '';
              const formatted = formatQuantityAuto(totalYieldAmount, unitAbbr, servingItem);
              if (formatted.amount !== 'N/A' && totalYieldAmount > 0) {
                return (
                  <Text style={styles.calculatedYieldText}>
                    (Yields: {formatted.amount} {formatted.unit})
                  </Text>
                );
              }
              return null;
            })()
          )}

          {/* Serving Size & Unit Inputs Row */}
          <View style={[styles.rowContainer, styles.inputGroup]}>
            <View style={styles.columnFlex}>
              <Text style={styles.label}>{t('screens.createRecipe.servingSizeLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('screens.createRecipe.servingSizePlaceholder')}
                placeholderTextColor={COLORS.placeholder}
                value={servingSize}
                onChangeText={setServingSize}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.columnFlex}>
              <Text style={styles.label}>{t('screens.createRecipe.servingUnitLabel')}</Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={openServingUnitSelector}>
                <Text style={[styles.pickerText, !servingUnitId && styles.placeholderText]}>
                  {selectedServingUnitName}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={24} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Serving Item Input (Removed unnecessary FlatList, fixed style) */}
          <View style={styles.inputGroup}> {/* MODIFIED: Used styles.inputGroup */}
            <Text style={styles.label}>{t('screens.createRecipe.servingItemLabel')}</Text>
            {/* Simplified display - use TextInput directly */}
            <TextInput
              style={styles.input}
              placeholder={t('screens.createRecipe.servingItemPlaceholder')}
              value={servingItem}
              onChangeText={setServingItem}
            />
          </View>

          {/* --- Components Section --- */}
          <View style={styles.componentsSection}>
            {/* === Ingredients List === */}
            <Text style={styles.sectionTitle}>{t('screens.createRecipe.ingredientsTitle')}</Text>
            {/* Use IngredientListComponent */}
            <IngredientListComponent
              onSelectUnit={openComponentUnitSelector}
              // ingredients={ingredientsList}
              ingredients={components.filter(c => !c.isPreparation)}
              units={units}
              pieceUnitId={pieceUnitId}
              originalServings={originalServings}
              numServings={numServings}
              onUpdate={handleComponentUpdate} // Pass existing handler
              onRemove={handleRemoveComponent} // Pass existing handler
              // onSelectUnit={openComponentUnitSelector} // Pass new handler for modal
              isPrepScreen={false} // Indicate this is not the prep screen context
            />
            <TouchableOpacity style={styles.addButton} onPress={() => openComponentSearchModal('ingredient')}>
              <Text style={styles.addButtonText}>{t('screens.createRecipe.addIngredientButton')}</Text>
            </TouchableOpacity>

            {/* Ingredient Unit Selection Modal */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={ingredientUnitModalVisible}
              onRequestClose={() => setIngredientUnitModalVisible(false)}
            >
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>{t('screens.createRecipe.selectIngredientUnitModalTitle')}</Text>
                  <FlatList
                    data={units.filter(u => {
                      if (!currentEditingItemMeasureKind) return true; // Show all if no lock
                      return unitKind(u) === currentEditingItemMeasureKind;
                    })} // Filter units based on currentEditingItemMeasureKind
                    keyExtractor={(item) => item.unit_id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.modalItem}
                        onPress={() => handleIngredientUnitSelect(item)}
                      >
                        <Text style={styles.modalItemText}>{item.unit_name} ({item.abbreviation || 'N/A'})</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={styles.emptyListText}>{t('screens.createRecipe.noUnitsFound')}</Text>}
                  />
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setIngredientUnitModalVisible(false)}
                  >
                    <Text style={styles.closeButtonText}>{t('common.close')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* === Preparations List === */}
            <Text style={styles.sectionTitle}>{t('screens.createRecipe.preparationsTitle')}</Text>
            {/* Use PreparationListComponent */}
            <PreparationListComponent
              preparations={preparationsList}
              units={units}
              originalServings={originalServings}
              numServings={numServings}
              onSelectPrep={handlePrepSelect} // Pass existing handler
              onRemove={handleRemoveComponent} // Pass existing handler
              onUpdate={handleComponentUpdate} // Pass existing handler
              onSelectUnit={openComponentUnitSelector}
            />
            <TouchableOpacity style={styles.addButton} onPress={() => openComponentSearchModal('preparation')}>
              <Text style={styles.addButtonText}>{t('screens.createRecipe.addPreparationButton')}</Text>
            </TouchableOpacity>
          </View>

          {/* Category Picker Trigger */}
          <Text style={styles.label}>{t('screens.createRecipe.categoryLabel')}</Text>
          <TouchableOpacity style={[styles.pickerTrigger, styles.inputGroup]} onPress={openCategorySelector}>
            <Text style={[styles.pickerText, !menuSectionId && styles.placeholderText]}>
              {selectedCategoryName}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={24} color={COLORS.textLight} />
          </TouchableOpacity>

          {/* Total Time Inputs Row */}
          <View style={[styles.rowContainer, styles.inputGroup]}>
            <View style={styles.columnFlex}>
              <Text style={styles.label}>{t('screens.createRecipe.timeHoursLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={COLORS.placeholder}
                value={totalTimeHours}
                onChangeText={setTotalTimeHours}
                keyboardType="numeric"
                maxLength={2} // Limit hours input
              />
            </View>
            <View style={styles.columnFlex}>
              <Text style={styles.label}>{t('screens.createRecipe.timeMinutesLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder="30"
                placeholderTextColor={COLORS.placeholder}
                value={totalTimeMinutes}
                onChangeText={setTotalTimeMinutes}
                keyboardType="numeric"
                maxLength={2} // Limit minutes input
              />
            </View>
          </View>

          {/* Directions Input - USE COMPONENT */}
          <Text style={styles.label}>{t('screens.createRecipe.directionsLabel')}</Text>
          <DirectionsInputList
            // Pass state using the renamed prop 'directions'
            directions={directions} // Updated prop name
            onDirectionsUpdate={setDirections}
          />

          {/* Cooking Notes Input */}
          <Text style={styles.label}>{t('screens.createRecipe.notesLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textArea, { minHeight: 60 }, styles.inputGroup]} // Shorter text area
            placeholder={t('screens.createRecipe.notesPlaceholder')}
            placeholderTextColor={COLORS.placeholder}
            value={cookingNotes}
            onChangeText={setCookingNotes}
            multiline
          />

          {/* Update Save Button Text Dynamically */}
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSaveDish}
            disabled={submitting || isScreenLoading}
          >
            {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>{t(isEditing ? 'screens.createRecipe.updateRecipeButton' : (isConfirming ? 'screens.createRecipe.confirmSaveButton' : 'screens.createRecipe.saveRecipeButton'))}</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- Modals --- */}

      {/* Component Search Modal - USE COMPONENT */}
      <ComponentSearchModal
        visible={componentSearchModalVisible}
        onClose={() => setComponentSearchModalVisible(false)}
        searchMode={searchMode}

        performSearch={async (query: string) => {
          const rawResults = await lookupIngredient(query);

          appLogger.log(`--- CreateDishScreen/performSearch/components:`, components);

          if (components && components.length > 0) {
            const existingComponentIds = new Set(
              components.map(comp => comp.ingredient_id)
            );

            const filteredResults = rawResults.filter((r: any) => {
              const item_id = r.ingredient_id;

              const isAlreadyAdded = existingComponentIds.has(item_id);

              if (isAlreadyAdded) {
                appLogger.log(`[performSearch] : ${r.name} (ID: ${item_id}) already exists.`);
              }

              return !isAlreadyAdded;
            });

                return filteredResults.map((r: any) => ({
                ingredient_id: r.ingredient_id,
                name: r.name,
                isPreparation: r.isPreparation || false
              }));
          }

          return rawResults.map((r: any) => ({
            ingredient_id: r.ingredient_id,
            name: r.name,
            isPreparation: r.isPreparation || false, // Assume false if not present
          }));
        }}

        onSelectItem={handleAddComponent} // Pass the existing handler
        onCreateNew={(name, isPreparation) => {
          // Call handleAddComponent, passing null for item_id and the correct isPreparation flag
          handleAddComponent({ name: name, isPreparation: isPreparation, ingredient_id: null });
        }}
      />

      {/* Category Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={categoryModalVisible}
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('screens.createRecipe.selectCategoryModalTitle')}</Text>
            <FlatList
              data={menuSections}
              keyExtractor={(item) => item.menu_section_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleCategorySelect(item)}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyListText}>{t('screens.createRecipe.noCategoriesFound')}</Text>}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCategoryModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Serving Unit Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={servingUnitModalVisible}
        onRequestClose={() => setServingUnitModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('screens.createRecipe.selectServingUnitModalTitle')}</Text>
            <FlatList
              data={units}
              keyExtractor={(item) => item.unit_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleServingUnitSelect(item)}
                >
                  <Text style={styles.modalItemText}>{item.unit_name} ({item.abbreviation || 'N/A'})</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyListText}>{t('screens.createRecipe.noUnitsFound')}</Text>}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setServingUnitModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

// --- Styles (Keep existing styles, add/modify as needed) --- 
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: SIZES.padding * 1.5, // Adjust horizontal padding
    paddingBottom: SIZES.padding * 5, // Ensure space for save button
  },
  inputGroup: {
    marginBottom: SIZES.padding * 1.8, // Increase bottom margin for spacing
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SIZES.padding, // Add gap between items in a row
  },
  columnFlex: { // New style for columns in a row
    flex: 1,
  },
  label: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginBottom: SIZES.base * 0.8, // Slightly smaller margin below label
  },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    ...FONTS.body3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75, // Match input padding
    minHeight: 48, // Ensure consistent height with TextInput
  },
  pickerText: {
    ...FONTS.body3,
    color: COLORS.text,
  },
  placeholderText: {
    color: COLORS.placeholder,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 2,
    width: '90%',
    maxHeight: '80%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.white,
    marginBottom: SIZES.padding * 1.5,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: SIZES.padding,
  },
  modalItemText: {
    fontSize: SIZES.font,
    color: COLORS.white,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: SIZES.padding * 2,
  },
  closeButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
  emptyListText: { // Style for empty lists in modals or main list
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: SIZES.padding * 2, // Add padding
    fontStyle: 'italic',
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.padding,
    fontSize: SIZES.font,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SIZES.padding,
    marginTop: SIZES.base,
  },
  componentItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SIZES.base, // Add space below each component item
  },
  componentNameText: {
    ...FONTS.body3,
    color: COLORS.text,
    flex: 1, // Allow name to take up space
    marginRight: SIZES.base,
  },
  componentControlsContainer: { // Container for amount, unit, remove
    flexDirection: 'row',
    alignItems: 'center',
  },
  componentInputAmount: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 50,
    textAlign: 'right',
    fontSize: SIZES.font,
  },
  readOnlyInput: {
    backgroundColor: COLORS.secondary,
    color: COLORS.textLight,
    borderColor: COLORS.secondary,
    marginRight: SIZES.base,
  },
  componentUnitTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    minHeight: 36,
    minWidth: 60,
  },
  itemInput: { // Style for the new item description input
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 80,
    fontSize: SIZES.font,
    marginLeft: SIZES.base,
    marginRight: SIZES.base,
  },
  removeButton: {
    paddingLeft: SIZES.base,
  },
  button: {
    padding: SIZES.padding * 1.5,
    borderRadius: SIZES.radius * 2,
    alignItems: 'center',
    marginTop: SIZES.padding,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.medium,
  },
  buttonText: {
    ...FONTS.h3,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
    borderWidth: 1,
    padding: SIZES.padding * 0.75,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: SIZES.base,
    marginBottom: SIZES.padding,
  },
  addButtonText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  toggleBtn: {
    padding: SIZES.padding,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
  },
  toggleText: {
    ...FONTS.body3,
    color: COLORS.text,
    textAlign: 'center',
  },
  toggleTextActive: {
    fontWeight: 'bold',
    color: COLORS.white,
  },
  componentsSection: { // Style for the moved components section
    marginBottom: SIZES.padding * 1.8, // Add margin below the whole section
  },
  // --- Styles for Directions List ---
  directionStepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align items to the top for multiline text
    marginBottom: SIZES.base, // Space between steps
  },
  stepNumber: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginRight: SIZES.base,
    paddingTop: SIZES.padding * 0.75,
    lineHeight: SIZES.padding * 1.5,
  },
  directionInput: {
    flex: 1, // Take remaining space
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75, // Match input padding
    ...FONTS.body3,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48, // Match other inputs
    textAlignVertical: 'top', // For multiline
  },
  removeStepButton: {
    marginLeft: SIZES.base,
    paddingTop: SIZES.padding * 0.75,
    justifyContent: 'center',
  },
  addStepButton: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
    borderWidth: 1,
    padding: SIZES.padding * 0.75,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: SIZES.base, 
  },
  addStepButtonText: {
    color: COLORS.white,
    ...FONTS.body3,
  },
  linkText: { textDecorationLine: 'underline', color: COLORS.primary },
  preparationCardContainer: {
    marginBottom: SIZES.base,
    position: 'relative', // Needed for absolute positioning of remove button
  },
  removeButtonPrepCard: {
    position: 'absolute',
    top: SIZES.padding / 2,
    right: SIZES.padding / 2,
    backgroundColor: 'rgba(0,0,0,0.2)', // Slight background for visibility
    borderRadius: 12,
    padding: 2,
  },
  scalingSection: { // Style for the slider section
    marginVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding / 2, 
    marginBottom: SIZES.base, 
  },
  calculatedYieldText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginTop: SIZES.base / 2, 
    textAlign: 'center',
  },
  // Styles for Serving Item input row
  servingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  servingItemInput: {
    flex: 1, 
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    ...FONTS.body3,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SIZES.base, 
  },
  servingItemPickerButton: {
    padding: SIZES.base,
  },
  searchLoader: {
    marginVertical: SIZES.padding * 2,
  },
  createNewButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderWidth: 1,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginHorizontal: SIZES.padding * 2,
  },
  createNewButtonText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
  },
  matchedBadge: {
    fontSize: SIZES.font,
    color: COLORS.primary,
    marginLeft: SIZES.base,
  },
  // Styles for inline serving item list
  servingItemListContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    maxHeight: 150, 
    backgroundColor: COLORS.surface,
  },
  servingItemList: {
    // No specific styles needed here if container manages layout
  },
  servingListItem: { 
    paddingVertical: SIZES.padding * 0.75,
    paddingHorizontal: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  servingListItemText: { 
    ...FONTS.body3,
    color: COLORS.text,
  },
  disabledButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  disabledButtonText: {
    color: COLORS.textLight,
  },
});

// Rename export
export default CreateDishScreen; 