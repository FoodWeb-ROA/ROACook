import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList, OnUpdatePrepAmountCallback } from '../navigation/types';
import { ParsedIngredient, Unit, Preparation, DishComponent, Ingredient, EditablePrepIngredient } from '../types';
import { useUnits, useIngredients } from '../hooks/useSupabase';
import { useLookup } from '../hooks/useLookup';
import AppHeader from '../components/AppHeader';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { capitalizeWords, formatQuantity, formatQuantityAuto } from '../utils/textFormatters';
import PreparationCard from '../components/PreparationCard';
import { useTranslation } from 'react-i18next';
import { slug, stripDirections, fingerprintPreparation } from '../utils/normalise';
import { 
  findDishByName, 
  findCloseIngredient, 
  checkIngredientNameExists, 
  checkPreparationNameExists,
  findPreparationByFingerprint 
} from '../data/dbLookup';
import { 
  resolveIngredient, 
  resolvePreparation
} from '../services/duplicateResolver';

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
    dishComponentScaledAmount
  } = route.params; 
  
  const { units, loading: loadingUnits } = useUnits();
  const { lookupIngredient } = useLookup();
  const { t } = useTranslation();

  const [prepName, setPrepName] = useState(preparation.name || 'Preparation');
  const [originalPrepBaseAmount, setOriginalPrepBaseAmount] = useState<number | null>(preparation.amount ?? null);
  const [prepUnitId, setPrepUnitId] = useState<string | null>(initialPrepUnitId ?? null);
  const [editableIngredients, setEditableIngredients] = useState<EditablePrepIngredient[]>(initialEditableIngredients ?? []);
  const [instructions, setInstructions] = useState<string[]>(initialInstructions ?? []);
  const [referenceIngredient, setReferenceIngredient] = useState<string | null>(null);

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

  const mapParsedIngredients = useCallback(async () => {
    const typedPrep = preparation as ParsedIngredient & { ingredients?: ParsedIngredient[]; instructions?: string[], reference_ingredient?: string | null };
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
      } catch (error) { console.error(`Error trying to match ingredient "${ing.name}":`, error);}
      
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
        reference_ingredient: ing.ingredient_type?.toLowerCase() === 'preparation' ? ing.reference_ingredient : null,
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
    
    setOriginalPrepBaseAmount(preparation.amount ?? null);
    
    const unitAbbrForDisplay = units.find(u => u.unit_id === prepUnitId)?.abbreviation ?? undefined;

    if (dishComponentScaledAmount !== null && dishComponentScaledAmount !== undefined) {
      console.log("Using dishComponentScaledAmount for initial display:", dishComponentScaledAmount);
      const formatted = formatQuantityAuto(dishComponentScaledAmount, unitAbbrForDisplay);
      setDisplayAmountStr(formatted.amount);
      
      let baseAmount: number | null = null;
      if (referenceIngredient) {
        const refIng = editableIngredients.find(ing => ing.name === referenceIngredient);
        baseAmount = refIng ? parseFloat(refIng.amountStr) : null;
      } else {
        baseAmount = preparation.amount ?? null;
      }
      if (baseAmount !== null && !isNaN(baseAmount) && baseAmount > 0) {
        const initialInternalScale = dishComponentScaledAmount / baseAmount;
        setScaleMultiplier(initialInternalScale);
        console.log(`Calculated initial internal scale: ${initialInternalScale} based on dish amount ${dishComponentScaledAmount} and base ${baseAmount}`);
      } else {
        setScaleMultiplier(parentScaleMultiplier);
         console.log(`Could not calculate initial internal scale, using parent scale: ${parentScaleMultiplier}`);
      }

    } else {
      console.log("dishComponentScaledAmount not provided, calculating display based on internal state and parent scale.");
      let baseAmountForScaling: number | null = null;
      if (referenceIngredient) {
        const refIng = editableIngredients.find(ing => ing.name === referenceIngredient);
        if (refIng) {
          baseAmountForScaling = parseFloat(refIng.amountStr);
        }
      } else {
        baseAmountForScaling = preparation.amount ?? null;
      }

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
    referenceIngredient, 
    dishComponentScaledAmount, 
    parentScaleMultiplier, 
    units
  ]);

  useEffect(() => {
    const typedPrep = preparation as ParsedIngredient & { ingredients?: ParsedIngredient[]; instructions?: string[], reference_ingredient?: string | null };
    setPrepName(typedPrep.name || 'Preparation');
    setOriginalPrepBaseAmount(typedPrep.amount ?? null);
    setReferenceIngredient(typedPrep.reference_ingredient || null);

    let needsParsing = false;
    if (initialEditableIngredients) {
        console.log("Using initial ingredients state provided via params.");
    } else {
        console.log("No initial ingredients state provided, will parse...");
        needsParsing = true;
    }

    if (initialInstructions) {
        console.log("Using initial instructions state provided via params.");
    } else {
        console.log("No initial instructions state provided, will parse...");
        setInstructions(typedPrep.instructions || []);
    }
    
    if (initialPrepUnitId) {
        console.log("Using initial prep unit ID provided via params.");
    } else {
        console.log("No initial prep unit ID provided, parsing unit...");
        needsParsing = true;
    }

    if (needsParsing) {
      if (isScreenLoading) {
        console.log("Need to parse but units are still loading...");
        return;
      }
      console.log("Parsing preparation components and/or unit...");
      if (!initialEditableIngredients) {
        mapParsedIngredients(); 
      }
      if (!initialPrepUnitId) {
        const parsedPrepUnit = typedPrep.unit?.toLowerCase().trim();
        let matchedPrepUnitId: string | null = null;
        if (parsedPrepUnit && units.length > 0) {
            const foundUnit = units.find(u => u.unit_name.toLowerCase() === parsedPrepUnit || u.abbreviation?.toLowerCase() === parsedPrepUnit);
            matchedPrepUnitId = foundUnit?.unit_id || null;
        }
        setPrepUnitId(matchedPrepUnitId);
      }
    }

  }, [preparation, isScreenLoading, units, initialEditableIngredients, initialInstructions, initialPrepUnitId, mapParsedIngredients]);

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
      console.error('Error searching components:', error);
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
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert(t('common.error'), t('alerts.errorAddComponentMissingName'));
      return;
    }

    const resolution = await resolveIngredient(trimmedName, t);
    
    if (resolution.mode === 'existing' && resolution.id) {
       addComponentWithDetails(resolution.id, trimmedName, false, true);
    } else if (resolution.mode === 'new') {
       const isPrep = !!selectedComponent.isPreparation;
       addComponentWithDetails('', trimmedName, isPrep, false); 
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

  const handleIngredientUpdate = (key: string, field: 'amountStr' | 'unitId' | 'item' | 'scaledAmountStr', value: string | null) => {
    let newDisplayAmountStr = displayAmountStr;

    if (field === 'scaledAmountStr') {
      const newScaledAmount = parseFloat(value || '0');
      // Prevent division by zero or NaN scaleMultiplier
      if (!isNaN(newScaledAmount) && scaleMultiplier !== 0 && !isNaN(scaleMultiplier)) {
        // Allow 0 as a potential input, calculate base even if 0
        const impliedBaseAmount = newScaledAmount >= 0 ? newScaledAmount / scaleMultiplier : 0; 
        
        setEditableIngredients(prev =>
          prev.map(ing => {
            if (ing.key === key) {
              // Update the actual base amount string
              return { ...ing, amountStr: String(impliedBaseAmount) };
            }
            return ing;
          })
        );
        
        // If it was the reference ingredient that was updated, recalculate the top display
        const updatedIngName = editableIngredients.find(ing => ing.key === key)?.name;
        if (referenceIngredient && updatedIngName === referenceIngredient) {
            const topUnitAbbr = units.find(u => u.unit_id === prepUnitId)?.abbreviation;
            // Recalculate top display based on the NEW implied base amount and the CURRENT scale multiplier
            newDisplayAmountStr = formatQuantityAuto(impliedBaseAmount * scaleMultiplier, topUnitAbbr).amount;
            console.log(`Reference ingredient base amount updated via scaled input. New top display: ${newDisplayAmountStr}`);
        }

      } else {
        // No need to warn if intermediate input is NaN, just don't update base amount
        // console.warn(`Invalid scaled amount entered or scaleMultiplier is zero/NaN: ${value}`);
      }
    } else {
      // Original handling for unitId and item
      setEditableIngredients(prev =>
        prev.map(ing => {
          if (ing.key === key) {
            // Handle 'unitId' and 'item' updates
            // Keep the original 'amountStr' logic out of this block
            if (field === 'unitId' || field === 'item') {
               return { ...ing, [field]: value };
            } else if (field === 'amountStr') {
              // Handle direct base amount updates if needed (e.g., if you add a base amount input later)
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

    setIsDirty(true); // Any update via this handler marks the definition as dirty
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
      console.warn("Navigation to sub-preparation edit from within preparation edit not fully implemented yet.");
    }
  };

  const handleInstructionChange = (index: number, text: string) => {
    const newInstructions = [...instructions];
    newInstructions[index] = text;
    setInstructions(newInstructions);
    setIsDirty(true);
  };

  const handleAddInstructionStep = () => {
    setInstructions([...instructions, '']);
    setIsDirty(true);
  };

  const handleRemoveInstructionStep = (index: number) => {
    if (instructions.length <= 1) return;
    const newInstructions = instructions.filter((_, i) => i !== index);
    setInstructions(newInstructions);
    setIsDirty(true);
  };

  const handleDisplayAmountChange = (text: string) => {
    setDisplayAmountStr(text); // Always update the display string

    const newScaledAmount = parseFloat(text);
    
    // Only calculate scale if input is a valid positive number
    if (!isNaN(newScaledAmount) && newScaledAmount > 0) { 
      let baseAmount: number | null = null;
      if (referenceIngredient) {
        const refIng = editableIngredients.find(ing => ing.name === referenceIngredient);
        baseAmount = refIng ? parseFloat(refIng.amountStr) : null;
      } else {
        baseAmount = originalPrepBaseAmount; 
      }

      // Also ensure baseAmount is valid and positive for scaling
      if (baseAmount !== null && !isNaN(baseAmount) && baseAmount > 0) {
        const newScaleMultiplier = newScaledAmount / baseAmount;
        setScaleMultiplier(newScaleMultiplier);
        console.log(`Scale updated to: ${newScaleMultiplier}`);
      } else {
        // Don't warn here, just don't update scale if base is invalid
        // console.warn("Cannot calculate scale: Invalid base amount for scaling reference.");
      }
    } // else: Input is not a valid positive number, do nothing with scaleMultiplier
  };

  const handleSaveChangesAndGoBack = useCallback(() => {
    if (onUpdatePrepAmount && prepKey) {
      console.log(`Calling update callback for prepKey: ${prepKey}, isDirty: ${isDirty}`);
      onUpdatePrepAmount(prepKey, {
        editableIngredients: editableIngredients,
        prepUnitId: prepUnitId,
        instructions: instructions,
        isDirty: isDirty,
      });
    } else {
      console.log("Callback not provided.");
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, onUpdatePrepAmount, prepKey, editableIngredients, prepUnitId, instructions, isDirty]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSaveChangesAndGoBack} style={{ marginRight: SIZES.padding }}>
          <Text style={{ color: COLORS.primary, ...FONTS.body3 }}>{t('common.done')}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleSaveChangesAndGoBack]);

  if (isScreenLoading) { 
      return <SafeAreaView style={styles.safeArea}><View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>
  }

  // Determine the correct unit abbreviation for the top display
  let topDisplayUnitAbbr = 'Unit';
  if (referenceIngredient) {
    const refIng = editableIngredients.find(ing => ing.name === referenceIngredient);
    if (refIng) {
      const refIngBaseAmount = parseFloat(refIng.amountStr);
      const refIngUnit = units.find(u => u.unit_id === refIng.unitId);
      const refIngBaseUnitAbbr = refIngUnit?.abbreviation;
      if (!isNaN(refIngBaseAmount) && refIngBaseUnitAbbr) {
        const scaledRefAmount = refIngBaseAmount * scaleMultiplier;
        // Use formatQuantityAuto to get the potentially converted unit suffix
        topDisplayUnitAbbr = formatQuantityAuto(scaledRefAmount, refIngBaseUnitAbbr).unit;
      } else {
         // Fallback if ref ing data is incomplete
         const prepYieldUnit = units.find(u => u.unit_id === prepUnitId);
         topDisplayUnitAbbr = prepYieldUnit?.abbreviation || 'Unit';
      }
    } else {
       // Fallback if ref ing not found in state (shouldn't happen)
       const prepYieldUnit = units.find(u => u.unit_id === prepUnitId);
       topDisplayUnitAbbr = prepYieldUnit?.abbreviation || 'Unit';
    }
  } else {
    // No reference ingredient, use the preparation's yield unit
    const prepYieldUnit = units.find(u => u.unit_id === prepUnitId);
    topDisplayUnitAbbr = prepYieldUnit?.abbreviation || 'Unit';
  }
  
  // Dynamically set the label based on whether there is a reference ingredient
  const amountLabel = referenceIngredient 
    ? t('screens.createPreparation.refIngredientAmountLabel', { ingredient: capitalizeWords(referenceIngredient) })
    : t('screens.createPreparation.scaledPrepAmountLabel');

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

          {referenceIngredient && (
            <View style={styles.refIngredientContainer}>
              <Text style={styles.label}>{t('screens.createPreparation.refIngredientLabel')}:</Text>
              <Text style={styles.itemText}>{capitalizeWords(referenceIngredient)}</Text>
            </View>
          )}

          <View style={styles.section}>
              <Text style={styles.label}>{amountLabel}:</Text>
              <View style={styles.componentControlsContainer}>
                   <TextInput
                       style={styles.componentInputAmount}
                       value={displayAmountStr}
                       onChangeText={handleDisplayAmountChange}
                       keyboardType="numeric"
                       placeholder={t('screens.createPreparation.amountPlaceholder')}
                       placeholderTextColor={COLORS.placeholder}
                   />
                   <TouchableOpacity
                       style={[styles.componentUnitTrigger, !!referenceIngredient && styles.disabledPicker]}
                       onPress={openPrepUnitModal}
                       disabled={!!referenceIngredient}
                   >
                       <Text style={[styles.pickerText, !prepUnitId && styles.placeholderText]}>
                           {topDisplayUnitAbbr}
                       </Text>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                   </TouchableOpacity>
               </View>
           </View>

          <View style={styles.section}>
              <Text style={styles.sectionHeader}>{t('screens.createPreparation.ingredientsTitle')}:</Text>
              {editableIngredients.length > 0 ? (
                editableIngredients.map((item) => {
                  const unit = units.find(u => u.unit_id === item.unitId);
                  const unitAbbr = unit?.abbreviation || 'Unit';
                  const baseAmountNum = parseFloat(item.amountStr);
                  const scaledAmount = isNaN(baseAmountNum) ? null : baseAmountNum * scaleMultiplier;
                  const formattedDisplay = formatQuantityAuto(scaledAmount, unitAbbr, item.item || undefined);

                  return (
                    <View key={item.key} style={item.isPreparation ? styles.preparationCardContainer : styles.componentItemContainer}>
                      {item.isPreparation ? (
                        <>
                          <PreparationCard
                             component={{
                               dish_id: '',
                               ingredient_id: item.ingredient_id || item.key,
                            name: item.name,
                               amount: isNaN(baseAmountNum) ? null : baseAmountNum,
                            unit: units.find(u => u.unit_id === item.unitId) || null,
                            isPreparation: true,
                               preparationDetails: {
                                 preparation_id: item.ingredient_id || item.key,
                                 name: item.name,
                                 yield_amount: isNaN(baseAmountNum) ? null : baseAmountNum,
                                 yield_unit: units.find(u => u.unit_id === item.unitId) || null,
                                 directions: null, total_time: null, reference_ingredient: null, ingredients: [], cooking_notes: null,
                               },
                            rawIngredientDetails: null,
                             }}
                              onPress={() => handleSubPreparationPress(item)}
                             scaleMultiplier={scaleMultiplier}
                             amountLabel={t('common.amount')}
                           />
                          <TouchableOpacity onPress={() => handleRemoveComponent(item.key)} style={styles.removeButtonPrepCard}>
                              <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                          </TouchableOpacity>
                         </>
                      ) : (
                        <>
                          <Text style={styles.componentNameText}>
                            {capitalizeWords(item.name)}
                          </Text>
                          <View style={styles.componentControlsContainer}>
                            <TextInput
                                style={[styles.componentInputAmount, { minWidth: 60 }]} 
                                placeholder={t('common.amount')}
                                placeholderTextColor={COLORS.placeholder}
                                value={formattedDisplay.amount}
                                onChangeText={(value) => handleIngredientUpdate(item.key, 'scaledAmountStr', value)}
                                keyboardType="numeric"
                            />
                            <TouchableOpacity
                              style={[styles.componentUnitTrigger, { minWidth: 60, marginLeft: SIZES.base }]} 
                              onPress={() => openUnitModal(item.key)}
                            >
                              <Text style={[styles.pickerText, !item.unitId && styles.placeholderText]}>
                                {/* Display only the unit abbreviation here */}
                                {unitAbbr} 
                              </Text>
                              <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                            </TouchableOpacity>
                          </View>

                          {/* Conditionally Render Item Input */}
                          {item.unitId === pieceUnitId && (
                             <TextInput
                                style={styles.itemInput} // Use existing style
                                placeholder="(e.g., large)"
                                placeholderTextColor={COLORS.placeholder}
                                value={item.item || ''}
                                onChangeText={(value) => handleIngredientUpdate(item.key, 'item', value)}
                             />
                          )}

                          {/* Remove Button - Position Adjusted */}
                          <TouchableOpacity 
                            onPress={() => handleRemoveComponent(item.key)} 
                            style={[styles.removeButton, item.unitId !== pieceUnitId && { marginLeft: SIZES.base } ]} // Add margin only if item input is NOT shown
                          >
                            <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.itemText}>{t('screens.createPreparation.noSubIngredients')}</Text>
              )}
               <TouchableOpacity
                style={styles.addButton}
                onPress={() => setComponentSearchModalVisible(true)}
              >
                <Text style={styles.addButtonText}>{t('screens.createRecipe.addIngredientPreparationButton')}</Text>
              </TouchableOpacity>
           </View>

          <View style={styles.section}>
              <Text style={styles.sectionHeader}>{t('screens.createPreparation.instructionsTitle')}:</Text>
              {instructions.length > 0 ? (
                instructions.map((step, index) => (
                  <View key={index} style={styles.directionStepContainer}>
                    <Text style={styles.stepNumber}>{index + 1}.</Text>
                    <TextInput
                      style={styles.directionInput}
                      placeholderTextColor={COLORS.placeholder}
                      value={step}
                      onChangeText={(text) => handleInstructionChange(index, text)}
                      multiline
                    />
                    {instructions.length > 1 && (
                      <TouchableOpacity 
                        onPress={() => handleRemoveInstructionStep(index)} 
                        style={styles.removeStepButton}
                      >
                        <MaterialCommunityIcons name="close-circle-outline" size={22} color={COLORS.textLight} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.itemText}>{t('screens.createPreparation.noInstructions')}</Text>
              )}
              <TouchableOpacity 
                onPress={handleAddInstructionStep} 
                style={styles.addStepButton}
              >
                 <Text style={styles.addStepButtonText}>{t('screens.createRecipe.addStepButton')}</Text>
              </TouchableOpacity>
           </View>

           <TouchableOpacity 
              style={[styles.button, styles.saveButton, { marginTop: SIZES.padding * 2 }]} 
              onPress={handleSaveChangesAndGoBack}
            >
              <Text style={styles.buttonText}>{isDirty ? t('common.saveChanges') : t('common.done')}</Text>
           </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

       <Modal
          animationType="slide"
          transparent={true}
          visible={unitModalVisible}
          onRequestClose={closeUnitModal}
       >
           <View style={styles.modalContainer}>
               <View style={styles.modalContent}>
                   <Text style={styles.modalTitle}>{t('screens.createPreparation.selectUnitModalTitle')}</Text>
                   <FlatList
                       data={units}
                       keyExtractor={(item) => item.unit_id}
                       renderItem={({ item }) => (
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
           </View>
       </Modal>

       <Modal
          animationType="slide"
          transparent={true}
          visible={prepUnitModalVisible}
          onRequestClose={closePrepUnitModal}
       >
           <View style={styles.modalContainer}>
               <View style={styles.modalContent}>
                   <Text style={styles.modalTitle}>{t('screens.createPreparation.selectPrepUnitModalTitle')}</Text>
                   <FlatList
                       data={units}
                       keyExtractor={(item) => item.unit_id}
                       renderItem={({ item }) => (
                           <TouchableOpacity
                               style={styles.modalItem}
                               onPress={() => handlePrepUnitSelect(item)}
                           >
                               <Text style={styles.modalItemText}>{capitalizeWords(item.unit_name)} ({item.abbreviation || 'N/A'})</Text>
                           </TouchableOpacity>
                       )}
                       ListEmptyComponent={<Text style={styles.emptyListText}>{t('screens.createRecipe.noUnitsFound')}</Text>}
                   />
                   <TouchableOpacity
                       style={styles.closeButton}
                       onPress={closePrepUnitModal}
                   >
                       <Text style={styles.closeButtonText}>{t('common.close')}</Text>
                   </TouchableOpacity>
               </View>
           </View>
       </Modal>

        <Modal
            animationType="slide"
            transparent={true}
            visible={componentSearchModalVisible}
            onRequestClose={() => setComponentSearchModalVisible(false)}
        >
           <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{t('screens.createRecipe.selectComponentModalTitle')}</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('screens.createRecipe.searchComponentPlaceholder')}
                        placeholderTextColor={COLORS.placeholder}
                        value={componentSearchQuery}
                        onChangeText={setComponentSearchQuery}
                    />
                    {searchLoading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={styles.searchLoader} />
                    ) : (
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item) => item.ingredient_id || `search-${item.name}`}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => handleAddComponent(item)}
                                >
                                    <Text style={styles.modalItemText}>
                                        {item.name} {item.isPreparation ? t('screens.createRecipe.prepSuffix') : ''}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                componentSearchQuery.trim() !== '' ? (
                                    <View>
                                        <Text style={styles.emptyListText}>
                                            {t('screens.createRecipe.searchNoResults')}
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.createNewButton, { marginTop: SIZES.padding }]}
                                            onPress={() => handleAddComponent({
                                                name: componentSearchQuery.trim(),
                                                isPreparation: false
                                            })}
                                        >
                                            <Text style={styles.createNewButtonText}>
                                                {t('screens.createRecipe.createButtonLabel', { query: componentSearchQuery.trim() })}
                                            </Text>
                                        </TouchableOpacity>
                                         <TouchableOpacity
                                            style={[styles.createNewButton, { marginTop: SIZES.padding, borderColor: COLORS.tertiary }]} 
                                            onPress={() => handleAddComponent({
                                                name: componentSearchQuery.trim(),
                                                isPreparation: true
                                            })}
                                        >
                                            <Text style={[styles.createNewButtonText, { color: COLORS.tertiary }]}>
                                                {t('screens.createRecipe.createButtonLabel', { query: componentSearchQuery.trim() })} {t('screens.createRecipe.prepSuffix')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <Text style={styles.emptyListText}>
                                        {t('screens.createRecipe.searchPlaceholderComponents')}
                                    </Text>
                                )
                            }
                        />
                    )}
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setComponentSearchModalVisible(false)}
                   >
                       <Text style={styles.closeButtonText}>{t('common.close')}</Text>
                   </TouchableOpacity>
               </View>
           </View>
       </Modal>

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
  section: { marginBottom: SIZES.padding * 1.5 },
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
});

export default CreatePreparationScreen; 