import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { Unit, Preparation, ComponentInput, DishComponent, MeasureKind } from '../types';
import PreparationCard from './PreparationCard'; // Assuming PreparationCard exists
import { capitalizeWords, formatQuantityAuto } from '../utils/textFormatters';
import { unitKind } from '../utils/unitHelpers'; // Corrected import path
import { normalizeAmountAndUnit } from '../utils/unitHelpers';
import { appLogger } from '../services/AppLogService';

interface PreparationListComponentProps {
  preparations: ComponentInput[];
  units: Unit[];
  originalServings: number;
  numServings: number;
  onSelectPrep: (prep: ComponentInput) => void; // Callback when a prep card is pressed
  onRemove: (key: string) => void; // Callback to remove a prep

  onUpdate: (key: string, field: 'amount' | 'unitId', value: string | null) => void;
  onSelectUnit: (key: string, measureKind: MeasureKind | null) => void; // Modified signature
}

const PreparationListComponent: React.FC<PreparationListComponentProps> = ({
  preparations,
  units,
  originalServings,
  numServings,
  onSelectPrep,
  onRemove,

  onUpdate,
  onSelectUnit,
}) => {
  const { t } = useTranslation();

  return (
    <View>
      {preparations.length === 0 ? (
        <Text style={styles.emptyListText}>{t('screens.createRecipe.noPreparations', 'No preparations added yet.')}</Text>
      ) : (
        preparations.map((item) => {
          // const prepUnit = units.find(u => u.unit_id === item.unit_id);
          // const prepAmountNum = parseFloat(item.amount);

          const itemKey = item.key;
          const itemUnitId = item.unit_id;
          const unit = units.find(u => u.unit_id === itemUnitId);
          const unitAbbr = unit?.abbreviation || t('common.unit', 'Unit');

          // Determine the MeasureKind of the preparation itself
          let prepMeasureKind: MeasureKind | null = null;
          if (item.isPreparation && item.originalPrep) {
            const currentOriginalPrep = item.originalPrep; // Assign to new const
            let originalPrepYieldUnitObj: Unit | null = currentOriginalPrep.yield_unit;
            if (!originalPrepYieldUnitObj && currentOriginalPrep.yield_unit_id) {
              originalPrepYieldUnitObj = units.find(u => u.unit_id === currentOriginalPrep.yield_unit_id) || null;
            }
            prepMeasureKind = unitKind(originalPrepYieldUnitObj);
          } else if (item.isPreparation) {
            // isPreparation but no originalPrep.unit info, try to use component's current unit's kind
            prepMeasureKind = unitKind(unit);
            appLogger.warn(`[PrepList] Prep ${item.name} has no originalPrep.unit, falling back to component's unit kind: ${String(prepMeasureKind)}`);
          } // If not a preparation, prepMeasureKind remains null, modal won't be restricted by prep's type

          // Amount of this preparation component used in the current dish (base, unscaled)
          const baseAmountOfPrepInDishStr = String(item.amount ?? '');
          const baseAmountOfPrepInDishNum = parseFloat(baseAmountOfPrepInDishStr);

          // The preparation's own original yield details
          let prepOriginalYieldUnitDetails: Unit | null = null;
          let prepOriginalYieldAmountValue: number | null = null;

          if (item.isPreparation && item.originalPrep) {
            prepOriginalYieldAmountValue = item.originalPrep.yield;
            // Find the unit object from the units array that matches the unit string from originalPrep
            prepOriginalYieldUnitDetails = item.originalPrep.yield_unit;
            if (!prepOriginalYieldUnitDetails && item.originalPrep.yield_unit_id) {
              prepOriginalYieldUnitDetails = units.find(
                u => u.unit_id === item.originalPrep.yield_unit_id
              ) || null;
            }
          } else if (!item.isPreparation) {
            // If it's a raw ingredient listed directly, it doesn't have its own 'yield'
            // but its 'amount' and 'unit_id' on the item itself are its base details.
            // This case might not be relevant if PreparationListComponent only lists preparations.
            // For safety, let's log if this happens unexpectedly.
            appLogger.warn(`[PrepList] Item ${item.name} is not a preparation but listed. Using its direct amount/unit as pseudo-yield.`);
            prepOriginalYieldAmountValue = baseAmountOfPrepInDishNum; // Or some other default/logic
            prepOriginalYieldUnitDetails = unit || null; // The unit of the component itself, coerced to Unit | null
          }

          // Construct necessary details for PreparationCard
          // Note: We might not have full sub-ingredient details here unless fetched/passed
          const pseudoPreparationDetails: Preparation = {
            preparation_id: item.ingredient_id,
            name: item.name,
            directions: item.prepStateInstructions ? item.prepStateInstructions.join('\n') : null,
            total_time: null, // Not typically available directly in ComponentInput
            yield_unit: prepOriginalYieldUnitDetails || null, // Use the prep's own original yield unit
            yield: prepOriginalYieldAmountValue ?? 1,       // Use the prep's own original yield amount
            ingredients: (item.prepStateEditableIngredients || []).map(subIng => { // Use stored state if available
              const subUnit = units.find(u => u.unit_id === subIng.unitId);
              const subAmount = parseFloat(subIng.amountStr);
              return {
                preparation_id: item.ingredient_id,
                ingredient_id: subIng.ingredient_id || subIng.name, // Use name as fallback ID
                name: capitalizeWords(subIng.name),
                amount: isNaN(subAmount) ? null : subAmount,
                unit: subUnit || null
              };
            }),
            cooking_notes: null // Not typically available directly
          };

          const componentForCard: DishComponent = {
            dish_id: '', // Placeholder
            ingredient_id: item.ingredient_id,
            name: item.name,
            amount: isNaN(baseAmountOfPrepInDishNum) ? null : baseAmountOfPrepInDishNum, // This is correct: amount of prep in dish
            unit: unit || null, 
            isPreparation: true,
            preparationDetails: pseudoPreparationDetails, // Use the constructed details
            rawIngredientDetails: null
          };

          const currentRecipeScale = (originalServings && numServings && originalServings > 0)
            ? numServings / originalServings
            : 1;

          // Scaled amount of THIS PREPARATION used in the CURRENT DISH
          const scaledAmountOfPrepInDish = isNaN(baseAmountOfPrepInDishNum) ? null : baseAmountOfPrepInDishNum * currentRecipeScale;
          // Use formatQuantityAuto for display (2 d.p. globally)
          const fq = formatQuantityAuto(scaledAmountOfPrepInDish, unitAbbr);
          const displayAmountStr = fq.amount;

          appLogger.log(`[PrepList] ${item.name}: baseAmountInDish=${baseAmountOfPrepInDishStr}, scale=${currentRecipeScale.toFixed(2)}, scaledInDish=${displayAmountStr}, prepOriginalYield=${prepOriginalYieldAmountValue}`);

          const handleAmountInputChange = (value: string) => {
            const num = parseFloat(value);
            if (!isNaN(num) && currentRecipeScale !== 0) {
              // De-scale the input value to get the base amount
              let baseAmountToNormalize = num / currentRecipeScale;

              // Get current unit details
              const currentUnit = units.find(u => u.unit_id === itemUnitId);
              if (!currentUnit || !currentUnit.abbreviation) {
                appLogger.warn(`[PrepList] Could not find unit or abbreviation for itemKey ${itemKey}, unitId ${itemUnitId}. Updating with raw value.`);
                onUpdate(itemKey, 'amount', value); // Fallback if unit info is missing
                return;
              }

              // Normalize the base amount and its unit
              const { amount: normalizedAmount, unitAbbr: normalizedUnitAbbr } = normalizeAmountAndUnit(baseAmountToNormalize, currentUnit.abbreviation);
              const newNormalizedUnit = units.find(u => u.abbreviation && u.abbreviation.toLowerCase() === normalizedUnitAbbr.toLowerCase());

              // Update the base amount
              onUpdate(itemKey, 'amount', normalizedAmount.toString());

              // If the unit changed during normalization, update the unitId as well
              if (newNormalizedUnit && newNormalizedUnit.unit_id !== currentUnit.unit_id) {
                onUpdate(itemKey, 'unitId', newNormalizedUnit.unit_id);
              }
            } else if (value === '') { // Allow clearing the input
              onUpdate(itemKey, 'amount', '');
            } else {
              // If input is not a number or scale is zero, update with raw value (or handle as error)
              appLogger.log(`[PrepList] Invalid input or zero scale for ${itemKey}: ${value}, scale: ${currentRecipeScale}`);
              onUpdate(itemKey, 'amount', value);
            }
          };

          return (
            <View key={item.key} style={styles.preparationCardContainer}>
              <PreparationCard
                amountLabel={t('common.amount', 'Amount')}
                component={componentForCard}
                onPress={() => onSelectPrep(item)}
                scaleMultiplier={currentRecipeScale}
              />

              <View style={styles.amountUnitRow}>
                <TextInput
                  style={styles.componentInputAmount}
                  placeholder={t('common.amount')}
                  placeholderTextColor={COLORS.placeholder}
                  value={displayAmountStr} // Use scaled amount for display
                  onChangeText={handleAmountInputChange} // Use new handler
                  key={`prep-amount-${itemKey}-${currentRecipeScale.toFixed(2)}`} // Force re-render on scale change
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.componentUnitTrigger, { marginLeft: SIZES.base }]}
                  onPress={() => onSelectUnit(itemKey, prepMeasureKind)} // Pass prepMeasureKind
                >
                  <Text style={[styles.pickerText, !itemUnitId && styles.placeholderText]}>
                    {unitAbbr}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => onRemove(item.key)} style={styles.removeButtonPrepCard}>
                <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyListText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: SIZES.padding * 2,
    fontStyle: 'italic',
  },
  preparationCardContainer: {
    marginBottom: SIZES.base,
    position: 'relative',
  },
  removeButtonPrepCard: {
    position: 'absolute',
    top: SIZES.padding / 2,
    right: SIZES.padding / 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 2,
    zIndex: 1, // Ensure button is clickable over the card
  },
  amountUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: SIZES.base,
    paddingHorizontal: SIZES.padding,
  },
  componentInputAmount: { //IngredientListComponent
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: SIZES.font,
    textAlign: 'right',
    minWidth: 80,
  },
  componentUnitTrigger: { //IngredientListComponent
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    minHeight: 36,
    width: 80,
    marginLeft: SIZES.base,
    justifyContent: 'space-between',
  },
  pickerText: { //IngredientListComponent
    ...FONTS.body3,
    color: COLORS.text,
    marginRight: 4,
    fontSize: SIZES.font,
    textAlign: 'right',
  },
  placeholderText: { // ngredientListComponent
    color: COLORS.placeholder,
  },
});

export default PreparationListComponent; 