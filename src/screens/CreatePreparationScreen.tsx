import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList} from '../navigation/types';
import { 
  Preparation, 
  EditablePrepIngredient, 
  ParsedIngredient,
  Unit, 
  Ingredient, // Added Ingredient back
} from '../types';
import { useUnits} from '../hooks/useSupabase';
import { useLookup } from '../hooks/useLookup';
import AppHeader from '../components/AppHeader';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { capitalizeWords, formatQuantityAuto} from '../utils/textFormatters';
import { useTranslation } from 'react-i18next';
import { fingerprintPreparation } from '../utils/normalise';
import { 
  findCloseIngredient, 
} from '../data/dbLookup';
import { 
  resolveIngredient, 
  resolvePreparation
} from '../services/duplicateResolver';
import { supabase } from '../data/supabaseClient';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Database } from '../data/database.types';
import { ComponentInput } from '../types';
import DirectionsInputList from '../components/DirectionsInputList';
import ComponentSearchModal, { SearchResultItem } from '../components/ComponentSearchModal';
import IngredientListComponent from '../components/IngredientListComponent';
import { appLogger } from '../services/AppLogService';
import { MeasureKind, unitKind } from '../utils/unitHelpers'; // Removed Unit from here

type CreatePrepRouteProp = RouteProp<RootStackParamList, 'CreatePreparation'>;

type CreatePrepNavProp = StackNavigationProp<RootStackParamList, 'CreatePreparation'>;

const CreatePreparationScreen = () => {
  const route = useRoute<CreatePrepRouteProp>();
  const navigation = useNavigation<CreatePrepNavProp>();
  const { 
    preparation, 
    scaleMultiplier: parentScaleMultiplier = 1,
    prepKey,
    onUpdatePrepAmount,
    initialEditableIngredients,
    initialPrepUnitId,
    initialInstructions,
    dishComponentScaledAmount,
    originalPrepBaseAmount: routeOriginalPrepBaseAmount,
    onNewPreparationCreated,
  } = route.params; 
  
  const { units, loading: loadingUnits } = useUnits();
  const { lookupIngredient } = useLookup();
  const { t } = useTranslation();
  const activeKitchenId = useSelector((state: RootState) => state.kitchens.activeKitchenId);

  // Determine if we arrived from AllRecipesScreen (stand-alone preview/edit) or from a parent recipe builder screen
  const isStandaloneMode = !onUpdatePrepAmount && !onNewPreparationCreated; // If there's no callback, assume stand-alone

  // Define type guards first
  const isFullPreparation = (p: ParsedIngredient | Preparation): p is Preparation => {
    return 'preparation_id' in p;
  };
  
  const isParsedIngredient = (p: ParsedIngredient | Preparation): p is ParsedIngredient => {
    return 'amount' in p || 'components' in p;
  };

  // Helper functions
  const getPreparationAmount = (prep: ParsedIngredient | Preparation): number | null => {
    if (isFullPreparation(prep)) return prep.yield ?? null;
    if (isParsedIngredient(prep)) return prep.amount ?? null;
    return null;
  };

  const getPreparationInstructions = (prep: ParsedIngredient | Preparation): string[] => {
    if (isFullPreparation(prep)) return prep.directions?.split('\n') || [];
    if (isParsedIngredient(prep)) return (prep as any).instructions || [];
    return [];
  };

  const getPreparationUnit = (prep: ParsedIngredient | Preparation): string | undefined => {
    if (isFullPreparation(prep)) return undefined; // Preparations don't have a unit property
    if (isParsedIngredient(prep)) return prep.unit ?? undefined; // Convert null to undefined
    return undefined;
  };

  // Use the helpers in state initialization
  const [prepName, setPrepName] = useState(preparation.name || 'Preparation');
  const [originalPrepBaseAmount, setOriginalPrepBaseAmount] = useState<number | null>(() => {
    return routeOriginalPrepBaseAmount ?? getPreparationAmount(preparation);
  });
  const [prepUnitId, setPrepUnitId] = useState<string | null>(initialPrepUnitId ?? null);
  const [editableIngredients, setEditableIngredients] = useState<EditablePrepIngredient[]>(initialEditableIngredients ?? []);
  const [instructions, setInstructions] = useState<string[]>(initialInstructions ?? getPreparationInstructions(preparation));

  const [scaleMultiplier, setScaleMultiplier] = useState(parentScaleMultiplier);
  const [displayAmountStr, setDisplayAmountStr] = useState('');
  
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [currentManagingComponentKey, setCurrentManagingComponentKey] = useState<string | null>(null);

  const [prepUnitModalVisible, setPrepUnitModalVisible] = useState(false);

  const [componentSearchModalVisible, setComponentSearchModalVisible] = useState(false);
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(Ingredient & { isPreparation?: boolean })[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [isScreenLoading, setIsScreenLoading] = useState(true);

  const [pieceUnitId, setPieceUnitId] = useState<string | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [searchMode, setSearchMode] = useState<'ingredient' | 'preparation'>('ingredient');

  // State for measurement type locking
  const [isTypeLocked, setIsTypeLocked] = useState<boolean>(false);
  const [lockedType, setLockedType] = useState<MeasureKind | null>(null);

  const mapParsedIngredients = useCallback(async () => {
    const typedPrep = preparation as ParsedIngredient & { ingredients?: ParsedIngredient[]; instructions?: string[] };
    const mappedIngredients: EditablePrepIngredient[] = [];
    
    for (const ing of (typedPrep.components || [])) {
      let matchedIngredient = null;
      let matched = false;
      let matchedUnitId: string | null = null;
      
      try {
        if (ing.ingredient_type !== 'Preparation') {
          const closeMatches = await findCloseIngredient(ing.name);
          if (closeMatches.length > 0) {
            matchedIngredient = closeMatches[0]; 
            matched = true;
          }
        }
      } catch (error) { appLogger.error(`Error trying to match ingredient "${ing.name}":`, error);}
      
      const parsedUnit = ing.unit?.toLowerCase().trim();
      if (parsedUnit && units.length > 0) {
        const foundUnit = units.find(u => u.unit_name.toLowerCase() === parsedUnit || u.abbreviation?.toLowerCase() === parsedUnit);
        matchedUnitId = foundUnit?.unit_id || null;
      }
      
      mappedIngredients.push({
        key: `prep-ing-${ing.name}-${Date.now()}`,
        ingredient_id: matched ? matchedIngredient?.ingredient_id : null,
        name: matched ? matchedIngredient?.name || ing.name : (ing.name || 'Unknown Ingredient'),
        amountStr: String(ing.amount ?? ''),
        unitId: matchedUnitId,
        isPreparation: ing.ingredient_type?.toLowerCase() === 'preparation',
        unit: ing.unit,
        item: ing.item || null,
        matched: matched,
      });
    }
    
    setEditableIngredients(mappedIngredients);
  }, [preparation, units, findCloseIngredient, setEditableIngredients]);

  useEffect(() => {
    const isLoading = loadingUnits;
    setIsScreenLoading(isLoading);
  }, [loadingUnits]);

  useEffect(() => {
    if (!isScreenLoading && units.length > 0 && !pieceUnitId) {
      const countUnit = units.find(u =>
        u.unit_name.toLowerCase() === 'piece' ||
        u.unit_name.toLowerCase() === 'count' ||
        u.abbreviation?.toLowerCase() === 'x'
      );
      setPieceUnitId(countUnit?.unit_id || null);
    }
  }, [isScreenLoading, units, pieceUnitId]);

  useEffect(() => {
    if (isScreenLoading) return;
    
    const baseAmountFromPrep = getPreparationAmount(preparation);
    setOriginalPrepBaseAmount(baseAmountFromPrep);
    
    const unitAbbrForDisplay = units.find(u => u.unit_id === prepUnitId)?.abbreviation ?? undefined;

    if (dishComponentScaledAmount !== null && dishComponentScaledAmount !== undefined) {
      appLogger.log("Using dishComponentScaledAmount for initial display:", dishComponentScaledAmount);
      const formatted = formatQuantityAuto(dishComponentScaledAmount, unitAbbrForDisplay);
      setDisplayAmountStr(formatted.amount);
      
      let baseAmount: number | null = null;

      baseAmount = baseAmountFromPrep;
      if (baseAmount !== null && !isNaN(baseAmount) && baseAmount > 0) {
        const initialInternalScale = dishComponentScaledAmount / baseAmount;
        setScaleMultiplier(initialInternalScale);
        appLogger.log(`Calculated initial internal scale: ${initialInternalScale} based on dish amount ${dishComponentScaledAmount} and base ${baseAmount}`);
      } else {
        setScaleMultiplier(parentScaleMultiplier);
         appLogger.log(`Could not calculate initial internal scale, using parent scale: ${parentScaleMultiplier}`);
      }

    } else {
      appLogger.log("dishComponentScaledAmount not provided, calculating display based on internal state and parent scale.");
      let baseAmountForScaling: number | null = null;
      baseAmountForScaling = baseAmountFromPrep;
    
      if (baseAmountForScaling !== null && !isNaN(baseAmountForScaling)) {
        const initialScaledAmount = baseAmountForScaling * parentScaleMultiplier;
        const formatted = formatQuantityAuto(initialScaledAmount, unitAbbrForDisplay);
        setDisplayAmountStr(formatted.amount);
      } else {
        setDisplayAmountStr('N/A');
      }
      setScaleMultiplier(parentScaleMultiplier);
    }

  }, [
    isScreenLoading, 
    preparation,
    prepUnitId,  
    dishComponentScaledAmount, 
    parentScaleMultiplier, 
    units
  ]);

  useEffect(() => {
    if (route.params?.onNewPreparationCreated) {
      setIsCreatingNew(true);
      if (!isFullPreparation(preparation)) {
         setEditableIngredients([]);
      }
      if (!isFullPreparation(preparation) && !initialEditableIngredients) {
         setInstructions(['']);
      }
      if (!isFullPreparation(preparation) && !initialPrepUnitId) {
         const defaultUnit = units.find(u => u.unit_name.toLowerCase() === 'portion') || units[0];
         setPrepUnitId(defaultUnit?.unit_id || null);
      }
      if (!isFullPreparation(preparation) && !preparation.name) {
          setPrepName('New Preparation');
      }
    } else {
        setIsCreatingNew(false);
    }
    if (isFullPreparation(preparation)) {
        appLogger.log("Editing existing full preparation, ID:", preparation.preparation_id);
    } else {
        appLogger.log("Editing/Creating based on ParsedIngredient or minimal data, Name:", preparation.name);
    }
  }, [route.params, preparation, initialEditableIngredients, initialInstructions, initialPrepUnitId, units]);

  useEffect(() => {
    if (routeOriginalPrepBaseAmount !== undefined) {
      setOriginalPrepBaseAmount(routeOriginalPrepBaseAmount);
    } else if (isFullPreparation(preparation)) {
      setPrepName(preparation.name || 'Preparation');
      setOriginalPrepBaseAmount(preparation.yield ?? null);
    } else {
      setPrepName(preparation.name || 'Preparation');
      setOriginalPrepBaseAmount(preparation.amount ?? null); // For new preps from parser
    }

    let needsParsing = false;
    if (initialEditableIngredients) {
        appLogger.log("Using initial ingredients state provided via params.");
    } else {
        appLogger.log("No initial ingredients state provided, will parse...");
        needsParsing = true;
    }

    if (initialInstructions) {
        appLogger.log("Using initial instructions state provided via params.");
    } else {
        appLogger.log("Initial instructions state was not provided via params, relying on useState initializer fallback.");
    }
    
    if (initialPrepUnitId) {
        appLogger.log("Using initial prep unit ID provided via params.");
    } else {
        appLogger.log("No initial prep unit ID provided, parsing unit...");
        needsParsing = true;
    }

    if (needsParsing) {
      if (isScreenLoading) {
        appLogger.log("Need to parse but units are still loading...");
        return;
      }
      appLogger.log("Parsing preparation components and/or unit...");
      if (!initialEditableIngredients) {
        mapParsedIngredients(); 
      }
      if (!initialPrepUnitId) {
        const parsedPrepUnit = getPreparationUnit(preparation)?.toLowerCase().trim();
        let matchedPrepUnitId: string | null = null;
        if (parsedPrepUnit && units.length > 0) {
            const foundUnit = units.find(u => u.unit_name.toLowerCase() === parsedPrepUnit || u.abbreviation?.toLowerCase() === parsedPrepUnit);
            matchedPrepUnitId = foundUnit?.unit_id || null;
        }
        setPrepUnitId(matchedPrepUnitId);
      }
    }

  }, [preparation, isScreenLoading, units, initialEditableIngredients, initialInstructions, initialPrepUnitId, mapParsedIngredients]);

  useEffect(() => {
    if (isScreenLoading || units.length === 0) return;

    let typeToLockInitial: MeasureKind | null = null;
    let shouldLockInitial = false;

    const fullPrep = preparation as Preparation; // Assuming it might be a full Preparation object

    if (isFullPreparation(preparation) && preparation.preparation_id) { // Existing prep
      // Ensure preparation.yield_unit is a Unit object, not just an ID string
      // This might require fetching the Unit object if yield_unit is stored as ID
      // For now, assuming preparation.yield_unit IS a Unit object or similar structure if it's a full prep.
      // If preparation.yield_unit is just an ID, we need to find it in `units` array.
      let yieldUnitObj: Unit | null | undefined = null;
      if (fullPrep.yield_unit_id) { // if yield_unit_id is present from DB
        yieldUnitObj = units.find(u => u.unit_id === fullPrep.yield_unit_id);
      } else if (fullPrep.yield_unit) { // if yield_unit object is directly on prep
        yieldUnitObj = fullPrep.yield_unit;
      }

      typeToLockInitial = unitKind(yieldUnitObj);
      // Lock if it's an existing prep with a discernible type that isn't 'count'
      // (count can always be changed to weight/volume)
      if (typeToLockInitial && typeToLockInitial !== 'count') {
        shouldLockInitial = true;
      }
    } else if (initialPrepUnitId) { // New prep, but initial unit from parser/parent
      const initialUnit = units.find(u => u.unit_id === initialPrepUnitId);
      typeToLockInitial = unitKind(initialUnit);
      // Lock if initial type from parser is weight or volume
      if (typeToLockInitial === 'weight' || typeToLockInitial === 'volume') {
        shouldLockInitial = true;
      }
    }
    // Else: truly fresh new prep, no lock yet.

    setLockedType(typeToLockInitial);
    setIsTypeLocked(shouldLockInitial);
    appLogger.log(`[CreatePrepScreen] Initial type lock: ${shouldLockInitial}, type: ${typeToLockInitial}`);

  }, [isScreenLoading, units, preparation, initialPrepUnitId]);

  const searchIngredients = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await lookupIngredient(query);
      setSearchResults(results);
    } catch (error) {
      appLogger.error('Error searching components:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [lookupIngredient]);

  useEffect(() => {
    const handler = setTimeout(() => {
      searchIngredients(componentSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [componentSearchQuery, searchIngredients]);

  const handleAddComponent = async (selectedComponent: any) => {
    const ingredient_id = selectedComponent?.ingredient_id || '';
    const name = selectedComponent?.name || '';
    const isPrep = !!selectedComponent.isPreparation;
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert(t('common.error'), t('alerts.errorAddComponentMissingName'));
      return;
    }

    setComponentSearchModalVisible(false);
    setComponentSearchQuery('');

    if (isPrep) {
        Alert.alert(
          t('common.warning'), 
          t('alerts.warningCannotCreatePrepInPrep') 
        );
        return;
    }

    const resolution = await resolveIngredient(trimmedName, t);
    
    if (resolution.mode === 'existing' && resolution.id) {
       addComponentWithDetails(resolution.id, trimmedName, false, true);
    } else if (resolution.mode === 'new') {
      try {
         const newIngId = await createNewIngredient(trimmedName);
         if (newIngId) {
            addComponentWithDetails(newIngId, trimmedName, false, false);
         }
      } catch (error) {
        appLogger.error(`Error creating new raw ingredient "${trimmedName}" from prep screen:`, error);
      }
    } else if (resolution.mode === 'cancel') {
        appLogger.log(`User cancelled ingredient creation for "${trimmedName}".`);
    }

    function addComponentWithDetails(id: string, name: string, isPrep: boolean, matched: boolean) {
      setEditableIngredients(prev => [
        ...prev,
        {
          key: `new-prep-ing-${id || 'new'}-${Date.now()}`,
          ingredient_id: id,
          name: name,
          amountStr: '',
          unitId: null,
          isPreparation: isPrep,
          matched: matched,
        }
      ]);
      setComponentSearchModalVisible(false);
      setComponentSearchQuery('');
      setIsDirty(true);
    }
  };

  const handleRemoveComponent = (key: string) => {
    setEditableIngredients(prev => prev.filter(c => c.key !== key));
    setIsDirty(true);
  };

  const handleIngredientUpdate = (key: string, field: 'amount' | 'amountStr' | 'unitId' | 'item' | 'scaledAmountStr', value: string | null) => {
    let newDisplayAmountStr = displayAmountStr;

    if (field === 'scaledAmountStr') {
      const newScaledAmount = parseFloat(value || '0');
      if (!isNaN(newScaledAmount) && scaleMultiplier !== 0 && !isNaN(scaleMultiplier)) {
        const impliedBaseAmount = newScaledAmount >= 0 ? newScaledAmount / scaleMultiplier : 0; 
        
        setEditableIngredients(prev =>
          prev.map(ing => {
            if (ing.key === key) {
              return { ...ing, amountStr: String(impliedBaseAmount) };
            }
            return ing;
          })
        );
        
        const updatedIngName = editableIngredients.find(ing => ing.key === key)?.name;
      }
    } else {
      setEditableIngredients(prev =>
        prev.map(ing => {
          if (ing.key === key) {
            if (field === 'unitId' || field === 'item') {
               return { ...ing, [field]: value };
            } else if (field === 'amountStr') {
              return { ...ing, amountStr: value ?? '' };
            }
          }
          return ing;
        })
      );
       if (field === 'unitId') {
          closeUnitModal();
       }
    }

    if (newDisplayAmountStr !== displayAmountStr) {
        setDisplayAmountStr(newDisplayAmountStr);
    }

    setIsDirty(true);
  };

  const openUnitModal = (key: string) => {
    setCurrentManagingComponentKey(key);
    setUnitModalVisible(true);
  };

  const closeUnitModal = () => {
      setCurrentManagingComponentKey(null);
      setUnitModalVisible(false);
  }

  const handleUnitSelect = (unit: Unit) => {
    if (currentManagingComponentKey) {
      handleIngredientUpdate(currentManagingComponentKey, 'unitId', unit.unit_id);
    }
  };

  const openPrepUnitModal = () => {
      setPrepUnitModalVisible(true);
  };

  const closePrepUnitModal = () => {
      setPrepUnitModalVisible(false);
  };

  const handlePrepUnitSelect = (unit: Unit) => {
      setPrepUnitId(unit.unit_id);
      closePrepUnitModal();
      setIsDirty(true);
  };

  const handleSubPreparationPress = (ingredient: EditablePrepIngredient) => {
    if (ingredient.isPreparation) {
      appLogger.warn("Navigation to sub-preparation edit from within preparation edit not fully implemented yet.");
    }
  };

  const handleDisplayAmountChange = (text: string) => {
    // Allow only numeric input with optional decimal point
    const sanitized = text.replace(/[^0-9.,]/g, '').replace(',', '.');
    setDisplayAmountStr(sanitized);

    // When in standalone mode (editing a preparation directly), this field represents the base yield
    const parsed = parseFloat(sanitized);
    if (!isNaN(parsed)) {
      setOriginalPrepBaseAmount(parsed);
    } else {
      setOriginalPrepBaseAmount(null);
    }

    setIsDirty(true);
  };

  const createNewPreparation = async (
    prepName: string, 
    prepFingerprint: string | null, 
    components: EditablePrepIngredient[], 
    directions: string[],
    yieldUnitId: string | null,
    yieldAmount: number | null,
    totalTimeMinutes: number | null,
    cookingNotes: string | null
  ): Promise<string | null> => { 
      const finalDirectionsStr = directions.map(s => s.trim()).filter(Boolean).join('\n');
      
      const finalFingerprint = prepFingerprint ?? fingerprintPreparation(
          components.map(epi => ({
              key: epi.key,
              name: epi.name,
              ingredient_id: epi.ingredient_id || "",
              amount: epi.amountStr,
              amountStr: epi.amountStr,
              unit_id: epi.unitId || null,
              isPreparation: epi.isPreparation || false,
              item: epi.item,
              matched: epi.matched || false,
          })),
          finalDirectionsStr
      );

      try {
          appLogger.log(`Creating new preparation DB entry: ${prepName}`);
          if (!yieldUnitId) {
            throw new Error(`Cannot create preparation '${prepName}': Missing yield unit ID.`);
          }
          if (!activeKitchenId) {
            throw new Error(`Cannot create preparation '${prepName}': No active kitchen selected.`);
          }

          const ingredientInsert: Database['public']['Tables']['ingredients']['Insert'] = {
            name: prepName.trim(),
            cooking_notes: cookingNotes?.trim() || undefined,
            unit_id: yieldUnitId,
            amount: yieldAmount ?? 1,
            kitchen_id: activeKitchenId,
          };
          const { data: ingredientInsertData, error: ingredientError } = await supabase
            .from('ingredients')
            .insert(ingredientInsert)
            .select('ingredient_id')
            .single();
          if (ingredientError) { throw ingredientError; }
          if (!ingredientInsertData?.ingredient_id) throw new Error("Failed to insert ingredient row for preparation.");
          const newPreparationId = ingredientInsertData.ingredient_id;

          const prepInsert = {
            preparation_id: newPreparationId,
            directions: finalDirectionsStr || undefined,
            total_time: totalTimeMinutes,
            fingerprint: finalFingerprint
          } as Database['public']['Tables']['preparations']['Insert'];
          const { error: prepError } = await supabase.from('preparations').insert(prepInsert);
          if (prepError) { throw prepError; }

          if (components.length > 0) {
             const validComponents = components.filter(c => 
               c.ingredient_id && c.unitId && !isNaN(parseFloat(c.amountStr))
             );
             
             if (validComponents.length !== components.length) {
               appLogger.warn(`Skipped ${components.length - validComponents.length} invalid components when creating preparation ${prepName}`);
             }
             
             if (validComponents.length === 0) {
               appLogger.warn(`No valid components to insert for preparation ${prepName}`);
             } else {
               const prepIngredientsInsert = validComponents.map(c => ({
                preparation_id: newPreparationId,
                  ingredient_id: c.ingredient_id!,
                amount: parseFloat(c.amountStr) || 0,
                  unit_id: c.unitId!,
             }));
             const { error: prepIngErr } = await supabase.from('preparation_ingredients').insert(prepIngredientsInsert);
             if (prepIngErr) { throw prepIngErr; }
             }
          }
          appLogger.log(`Successfully created preparation '${prepName}' with ID: ${newPreparationId}`);
          return newPreparationId;
      } catch (error) {
         appLogger.error(`Error in createNewPreparation for ${prepName}:`, error);
         Alert.alert(t('common.error'), t('alerts.errorCreatingPreparation', { name: prepName }));
         throw error;
      }
  };

  const handleSaveChangesAndGoBack = useCallback(async () => {
    if (isCreatingNew) {
      setSubmitting(true);
      try {
        const trimmedName = prepName.trim();
        if (!trimmedName) {
          Alert.alert(t('common.error'), t('alerts.errorMissingPrepName'));
          setSubmitting(false);
          return;
        }
        if (!prepUnitId) {
          Alert.alert(t('common.error'), t('alerts.errorMissingPrepYieldUnit'));
          setSubmitting(false);
          return;
        }

        const componentsForFingerprint: ComponentInput[] = editableIngredients.map(epi => ({
              key: epi.key,
              name: epi.name,
              ingredient_id: epi.ingredient_id || "",
              amount: epi.amountStr,
              amountStr: epi.amountStr, 
              unit_id: epi.unitId || null,
              isPreparation: epi.isPreparation || false,
              item: epi.item,
              matched: epi.matched || false,
          }));
        const finalDirectionsStr = instructions.map(s => s.trim()).filter(Boolean).join('\n');
        const prepFingerprint = fingerprintPreparation(componentsForFingerprint, finalDirectionsStr);

        const prepResolution = await resolvePreparation(trimmedName, prepFingerprint, null, t);

        let finalPrepId: string | null = null;
        let finalPrepName = trimmedName;
        let finalYieldAmount = originalPrepBaseAmount;
        let finalYieldUnitId = prepUnitId;

        if (prepResolution.mode === 'cancel') {
          appLogger.log("User cancelled preparation creation.");
          setSubmitting(false);
          return;
        }

        if (prepResolution.mode === 'existing' && prepResolution.id) {
          appLogger.log(`Preparation content identical to existing ID: ${prepResolution.id}. Using existing.`);
          finalPrepId = prepResolution.id;
        } else if (prepResolution.mode === 'overwrite' && prepResolution.id) {
          appLogger.log(`Overwriting existing preparation: ${prepResolution.id}`);
          Alert.alert("Info", "Overwrite functionality is under development. Please rename or cancel.");
          setSubmitting(false);
          return;
        } else if (prepResolution.mode === 'rename' && prepResolution.newName) {
          appLogger.log(`Creating new preparation with renamed: ${prepResolution.newName}`);
          finalPrepName = prepResolution.newName;
          finalPrepId = await createNewPreparation(
            finalPrepName,
            prepFingerprint,
            editableIngredients,
            instructions,
            prepUnitId,
            originalPrepBaseAmount,
            null,
            null
          );
        } else {
          appLogger.log(`Creating new preparation: ${trimmedName}`);
          finalPrepId = await createNewPreparation(
            trimmedName,
            prepFingerprint,
            editableIngredients,
            instructions,
            prepUnitId,
            originalPrepBaseAmount,
            null,
            null
          );
        }

        // After successful creation of a new preparation, update the measurement type lock state
        if (finalPrepId) {
          const newlySavedUnit = units.find(u => u.unit_id === finalYieldUnitId);
          const newKind = unitKind(newlySavedUnit);
          
          appLogger.log(`[CreatePrepScreen] New prep ${finalPrepId} saved. Yield unit: ${newlySavedUnit?.unit_name}, Kind: ${newKind}`);

          if (newKind === 'weight' || newKind === 'volume') {
            // Hard lock for weight/volume units
            setLockedType(newKind);
            setIsTypeLocked(true);
            appLogger.log(`[CreatePrepScreen] Type HARD LOCKED to: ${newKind}`);
          } else if (newKind === 'count') {
            // For count units, we don't hard lock yet - allow switching to weight/volume
            setLockedType('count'); 
            setIsTypeLocked(false);
            appLogger.log(`[CreatePrepScreen] Type is 'count'. Not hard-locked from weight/volume yet.`);
          } else {
            // For null/unknown unit kinds (shouldn't happen with selected units)
            setLockedType(null);
            setIsTypeLocked(false); 
            appLogger.log(`[CreatePrepScreen] Yield unit kind is null/unknown. Lock cleared.`);
          }
        }

        if (finalPrepId && onNewPreparationCreated) {
           onNewPreparationCreated({
            id: finalPrepId,
            name: finalPrepName,
            yield: finalYieldAmount, 
            amount_unit_id: finalYieldUnitId,
          });
        }

        if (navigation.canGoBack()) {
          navigation.goBack();
        }

      } catch (error) {
        appLogger.error("Error during preparation creation:", error);
      } finally {
        setSubmitting(false);
      }

    } else {
      if (onUpdatePrepAmount && prepKey) {
        appLogger.log(`Calling update callback for prepKey: ${prepKey}, isDirty: ${isDirty}`);
        onUpdatePrepAmount(prepKey, {
          editableIngredients: editableIngredients,
          prepUnitId: prepUnitId,
          instructions: instructions,
          isDirty: isDirty,
        });
      } else {
        appLogger.log("Callback 'onUpdatePrepAmount' not provided.");
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  }, [
    isCreatingNew, 
    prepName, 
    prepUnitId, 
    editableIngredients, 
    instructions, 
    originalPrepBaseAmount,
    t, 
    createNewPreparation, 
    resolvePreparation, 
    route.params, 
    navigation, 
    onUpdatePrepAmount, 
    prepKey, 
    isDirty
  ]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSaveChangesAndGoBack} style={{ marginRight: SIZES.padding }}>
          <Text style={{ color: COLORS.primary, ...FONTS.body3 }}>{t('common.done')}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleSaveChangesAndGoBack]);

  // Navigation guard – prompt to save/discard on back if there are unsaved edits
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty) return; // Nothing to save

      e.preventDefault(); // Stop default behaviour

      Alert.alert(
        t('alerts.unsavedChangesTitle', 'Unsaved Changes'),
        t('alerts.unsavedChangesMessage', 'Do you want to save your changes before leaving?'),
        [
          {
            text: t('common.discard', 'Discard'),
            style: 'destructive',
            onPress: () => {
              // Discard edits
              setIsDirty(false);
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: t('common.save', 'Save'),
            onPress: () => {
              saveAndGoBack(e.data.action);
            },
          },
          {
            text: t('common.cancel', 'Cancel'),
            style: 'cancel',
          },
        ],
      );
    });

    return unsubscribe;
  }, [navigation, isDirty]);

  /**
   * Helper that finalises save logic then navigates back.
   * For embedded mode the parent already has latest edits via onUpdatePrepAmount; just mark clean.
   * For standalone mode call existing save handler if it exists (handleSaveChangesAndGoBack).
   */
  const saveAndGoBack = (navAction?: any) => {
    if (isStandaloneMode && typeof handleSaveChangesAndGoBack === 'function') {
      // @ts-ignore – function is defined later in file
      handleSaveChangesAndGoBack().then(() => {
        setIsDirty(false);
        if (navAction) navigation.dispatch(navAction); else navigation.goBack();
      });
    } else {
      // Parent mode – data already propagated
      setIsDirty(false);
      if (navAction) navigation.dispatch(navAction); else navigation.goBack();
    }
  };

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
    const defaultUnitId = defaultUnit?.unit_id;
    
    if (!defaultUnitId) {
       appLogger.error(`Cannot create ingredient '${trimmedName}': No default unit found.`);
       Alert.alert(t('common.error'), t('alerts.errorCreatingIngredientNoDefaultUnit'));
       return null;
    }

    appLogger.log(`Creating new ingredient DB entry: ${trimmedName}`);
    try {
      const ingredientInsert: Database['public']['Tables']['ingredients']['Insert'] = {
        name: trimmedName,
        kitchen_id: activeKitchenId,
        unit_id: defaultUnitId, 
        amount: 1, // Default amount
      };
      const { data, error } = await supabase
        .from('ingredients')
        .insert(ingredientInsert)
        .select('ingredient_id')
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation
          appLogger.warn(`Ingredient named \"${trimmedName}\" likely already exists (unique constraint). Attempting lookup.`);
          // TODO: Need checkIngredientNameExists from useLookup or dbLookup here
          // const existingIdString: string | null = await checkIngredientNameExists(trimmedName);
          // if (existingIdString) return existingIdString;
           appLogger.warn("Lookup for existing ingredient ID on unique violation is not implemented yet in CreatePreparationScreen.");
        }
        appLogger.error(`Error inserting new ingredient '${trimmedName}':`, error);
        throw error; 
      }

      if (!data?.ingredient_id) {
        throw new Error("Failed to retrieve new ingredient ID after insert.");
      }
      
      appLogger.log(`Successfully created ingredient '${trimmedName}' with ID: ${data.ingredient_id}`);
      return data.ingredient_id;

    } catch (error) {
      appLogger.error(`Error in createNewIngredient for ${trimmedName}:`, error);
      Alert.alert(t('common.error'), t('alerts.errorCreatingIngredient', { name: trimmedName }));
      return null; 
    }
  };

  // ADDED: Handler to open unit modal (passed to IngredientListComponent)
  const openIngredientUnitSelector = (key: string) => {
    setCurrentManagingComponentKey(key);
    setUnitModalVisible(true);
  }

  if (isScreenLoading) { 
      return <SafeAreaView style={styles.safeArea}><View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>
  }

  let topDisplayUnitAbbr = 'Unit';
  const prepYieldUnit = units.find(u => u.unit_id === prepUnitId);
  topDisplayUnitAbbr = prepYieldUnit?.abbreviation || 'Unit';
  
  const amountLabel = t('screens.createPreparation.yieldLabel', 'Yield');

  // Determine if warning about type lock should be shown
  // Warning should show if:
  // 1. Type is not already locked (isTypeLocked is false)
  // 2. It's a truly new preparation (not an existing one being edited - identified by !preparation.preparation_id)
  // 3. It's NOT a new preparation coming from the parser with a pre-determined weight/volume unit (identified by initialPrepUnitId having a weight/volume kind)
  const isFromParserWithMassOrVolume = initialPrepUnitId && 
                                     (unitKind(units.find(u => u.unit_id === initialPrepUnitId)) === 'weight' || 
                                      unitKind(units.find(u => u.unit_id === initialPrepUnitId)) === 'volume');

  const isFreshPrepNoLock = !isTypeLocked && 
                            !(isFullPreparation(preparation) && preparation.preparation_id) && 
                            !isFromParserWithMassOrVolume;

  // Data source for the prep yield unit modal
  const getPrepYieldUnitModalDataSource = () => {
    if (isTypeLocked && lockedType && lockedType !== 'count') {
      return units.filter(u => unitKind(u) === lockedType);
    }
    // If not strictly locked (e.g. fresh prep, or locked to 'count')
    // And a weight/volume unit is currently selected for a fresh prep (but not yet saved to lock it)
    // then restrict choices to that kind or 'count' for this modal session.
    if (!isTypeLocked) {
        const currentSelectedUnit = units.find(u => u.unit_id === prepUnitId);
        const currentSelectedKind = unitKind(currentSelectedUnit);
        if (currentSelectedKind && currentSelectedKind !== 'count') { 
            return units.filter(u => unitKind(u) === currentSelectedKind || unitKind(u) === 'count' || unitKind(u) === null);
        }
    }
    return units; // Default: show all units
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title={t('screens.createPreparation.title')} showBackButton={true} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.prepName}>{capitalizeWords(prepName)}</Text>

          {/* Unified numeric input for both modes; label changes depending on entry point */}
          <View style={styles.section}>
            <Text style={styles.label}>{amountLabel}:</Text>
            <View style={styles.componentControlsContainer}>
              <TextInput
                style={styles.componentInputAmount}
                value={displayAmountStr}
                onChangeText={handleDisplayAmountChange}
                keyboardType="numeric"
                placeholder={t('screens.createPreparation.yieldPlaceholder')}
                placeholderTextColor={COLORS.placeholder}
              />
              <TouchableOpacity
                style={[styles.componentUnitTrigger]}
                onPress={openPrepUnitModal}
              >
                <Text style={[styles.pickerText, !prepUnitId && styles.placeholderText]}>
                  {topDisplayUnitAbbr}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
              <Text style={styles.sectionHeader}>{t('screens.createPreparation.ingredientsTitle')}</Text>
              {/* Use IngredientListComponent */}
              <IngredientListComponent 
                ingredients={editableIngredients}
                units={units}
                pieceUnitId={pieceUnitId}
                scaleMultiplier={scaleMultiplier}
                onUpdate={handleIngredientUpdate}
                onRemove={handleRemoveComponent}
                onSelectUnit={openIngredientUnitSelector}
                isPrepScreen={true} // Indicate this IS the prep screen context
              />
               <TouchableOpacity
                 style={styles.addButton}
                 onPress={() => setComponentSearchModalVisible(true)}
               >
                 <Text style={styles.addButtonText}>{t('screens.createRecipe.addIngredientButton')}</Text>
               </TouchableOpacity>
           </View>

           {/* --- ADDED Preparations Header --- */}
           <Text style={styles.sectionHeader}>{t('common.preparations', 'Preparations')}</Text>
           {/* Intentionally empty section for now, as requested header is added below ingredients */}
           {/* --- END ADDED Header --- */}

           {/* ADDED: Button to search for existing Preparations */}
           <TouchableOpacity
              style={styles.addButton} // Reuse same style
              onPress={() => {
                  setComponentSearchQuery(''); // Clear previous search
                  setSearchResults([]);
                  setSearchMode('preparation'); // Set mode for preparation search
                  setComponentSearchModalVisible(true);
              }}
            >
              <Text style={styles.addButtonText}>{t('screens.createRecipe.addPreparationButton')}</Text>
            </TouchableOpacity>

          <View style={styles.section}>
              <Text style={styles.sectionHeader}>{t('screens.createPreparation.instructionsTitle')}</Text>
              <DirectionsInputList
                 directions={instructions}
                 onDirectionsUpdate={setInstructions}
              />
           </View>

           <TouchableOpacity 
              style={[styles.button, styles.saveButton, { marginTop: SIZES.padding * 2 }]} 
              onPress={handleSaveChangesAndGoBack}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>
                  {isCreatingNew ? t('common.create') : (isDirty ? t('common.saveChanges') : t('common.done'))}
                </Text>
              )}
           </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

       <Modal
          animationType="fade"
          transparent
          visible={unitModalVisible}
          onRequestClose={closeUnitModal}
       >
           <TouchableOpacity style={styles.modalBackdrop} onPress={() => setUnitModalVisible(false)} activeOpacity={1}>
               <View style={styles.modalContent}>
                   <Text style={styles.modalTitle}>{t('screens.createPreparation.selectUnitModalTitle')}</Text>
                   <FlatList
                       data={units}
                       keyExtractor={(item: Unit) => item.unit_id}
                       renderItem={({ item }: { item: Unit }) => (
                           <TouchableOpacity
                               style={styles.modalItem}
                               onPress={() => handleUnitSelect(item)}
                           >
                               <Text style={styles.modalItemText}>{capitalizeWords(item.unit_name)} ({item.abbreviation || 'N/A'})</Text>
                           </TouchableOpacity>
                       )}
                       ListEmptyComponent={<Text style={styles.emptyListText}>{t('screens.createRecipe.noUnitsFound')}</Text>}
                   />
                   <TouchableOpacity
                       style={styles.closeButton}
                       onPress={closeUnitModal}
                   >
                       <Text style={styles.closeButtonText}>{t('common.close')}</Text>
                   </TouchableOpacity>
               </View>
           </TouchableOpacity>
       </Modal>

       <Modal
          animationType="fade"
          transparent
          visible={prepUnitModalVisible}
          onRequestClose={() => setPrepUnitModalVisible(false)}
       >
           <TouchableOpacity style={styles.modalBackdrop} onPress={() => setPrepUnitModalVisible(false)} activeOpacity={1}>
               <View style={styles.modalContent}>
                   <Text style={styles.modalTitle}>{t('screens.createPreparation.selectPrepUnitModalTitle')}</Text>
                   <FlatList
                       data={getPrepYieldUnitModalDataSource() as Unit[]} // Ensure data is typed correctly
                       keyExtractor={(item: Unit) => item.unit_id}
                       renderItem={({ item }: { item: Unit }) => (
                           <TouchableOpacity
                               style={styles.modalItem}
                               onPress={() => {
                                   setPrepUnitId(item.unit_id);
                                   setPrepUnitModalVisible(false);
                                   setIsDirty(true);
                               }}
                           >
                               <Text style={styles.modalItemText}>{`${item.unit_name} (${item.abbreviation || 'N/A'})`}</Text>
                           </TouchableOpacity>
                       )}
                   />
                   <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPrepUnitModalVisible(false)}>
                     <Text style={styles.modalCloseButtonText}>{t('common.cancel')}</Text>
                   </TouchableOpacity>
               </View>
           </TouchableOpacity>
       </Modal>

        <ComponentSearchModal
           visible={componentSearchModalVisible}
           onClose={() => setComponentSearchModalVisible(false)}
           searchMode={searchMode}
           performSearch={async (query) => {
              const results = await lookupIngredient(query);
              return results.map((r: any) => ({ 
                  ingredient_id: r.ingredient_id,
                  name: r.name,
                  isPreparation: false,
              }));
           }}
           onSelectItem={handleAddComponent}
           onCreateNew={(name, isPreparation) => {
              if (!isPreparation) {
                 handleAddComponent({ name: name, isPreparation: false, ingredient_id: null });
              } else {
                 Alert.alert(t('common.warning'), t('alerts.warningCannotCreatePrepInPrep'));
              }
           }}
        />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  contentContainer: { 
    paddingHorizontal: SIZES.padding * 1.5,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.padding * 4 
  },
  prepName: { ...FONTS.h2, color: COLORS.white, marginBottom: SIZES.padding },
  refIngredientContainer: {
    marginBottom: SIZES.padding,
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: { 
    marginBottom: SIZES.padding * 1.5, 
    marginTop: SIZES.padding,
  },
  sectionHeader: { ...FONTS.h3, color: COLORS.white, marginBottom: SIZES.padding },
  itemText: { ...FONTS.body3, color: COLORS.text, marginBottom: SIZES.base / 2, marginLeft: SIZES.padding },
  metaText: { ...FONTS.body3, color: COLORS.textLight, marginBottom: SIZES.base },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginBottom: SIZES.base * 0.8,
  },
  componentItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding / 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SIZES.base,
  },
  componentNameText: {
    ...FONTS.body3,
    color: COLORS.text,
    flex: 0.4,
    marginRight: SIZES.base,
  },
  componentControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.6,
    justifyContent: 'flex-end',
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
    justifyContent: 'space-between',
    marginLeft: SIZES.base,
  },
  pickerText: {
    ...FONTS.body3,
    color: COLORS.text,
    marginRight: 4,
  },
  placeholderText: {
    color: COLORS.placeholder,
  },
  removeButton: {
    paddingLeft: SIZES.base,
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  directionStepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SIZES.base,
  },
  stepNumber: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginRight: SIZES.base,
    paddingTop: SIZES.padding * 0.75,
    lineHeight: SIZES.padding * 1.5,
  },
  directionInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    ...FONTS.body3,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48,
    textAlignVertical: 'top',
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
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
    borderWidth: 1,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: SIZES.padding,
  },
  addButtonText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
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
  searchLoader: {
    marginVertical: SIZES.padding * 2,
  },
  emptyListText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: SIZES.padding * 2,
    fontStyle: 'italic',
  },
  createNewButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderWidth: 1,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginHorizontal: SIZES.padding,
  },
  createNewButtonText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
  },
  preparationCardContainer: {
    marginBottom: SIZES.base,
    position: 'relative',
  },
  removeButtonPrepCard: {
    position: 'absolute',
    top: SIZES.padding / 2,
    right: SIZES.padding / 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 2,
    zIndex: 1,
  },
  itemInput: {
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
  },
  matchedBadge: {
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    paddingHorizontal: SIZES.padding * 0.25,
    paddingVertical: SIZES.padding * 0.125,
    borderRadius: SIZES.radius,
    marginLeft: SIZES.base,
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
  scaledAmountText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginRight: SIZES.base,
  },
  disabledPicker: {
    opacity: 0.5,
  },
  disabledButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  disabledButtonText: {
    color: COLORS.textLight,
  },
  warningTextSmall: {
    ...FONTS.body3,
    color: COLORS.warning,
    marginTop: SIZES.base / 2,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    marginTop: SIZES.padding,
    paddingVertical: SIZES.small,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    alignSelf: 'center',
  },
  modalCloseButtonText: {
    ...FONTS.body2,
    color: COLORS.white,
    textAlign: 'center',
  },
});

export default CreatePreparationScreen; 