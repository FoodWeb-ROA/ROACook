import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { Unit, Preparation, ComponentInput, DishComponent, MeasureKind } from '../types';
import PreparationCard from './PreparationCard'; // Assuming PreparationCard exists
import { capitalizeWords } from '../utils/textFormatters';
import { appLogger } from '../services/AppLogService';

interface PreparationListComponentProps {
  preparations: ComponentInput[];
  units: Unit[];
  originalServings: number;
  numServings: number;
  onSelectPrep: (prep: ComponentInput) => void; // Callback when a prep card is pressed
  onRemove: (key: string) => void; // Callback to remove a prep

  onUpdate: (key: string, field: 'amount' | 'unitId', value: string | null) => void;
  onSelectUnit?: (key: string, measureKind: MeasureKind | null) => void; // optional, deprecated
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
          // Units are not relevant for preparations (they are unitless multipliers)

          // Determine the MeasureKind of the preparation itself
          let prepMeasureKind: MeasureKind | null = null;
          if (item.isPreparation && item.originalPrep) {
            const currentOriginalPrep = item.originalPrep; // Assign to new const
            prepMeasureKind = null;
          } else if (item.isPreparation) {
            // isPreparation but no originalPrep.unit info, try to use component's current unit's kind
            // prepMeasureKind = unitKind(unit);
            appLogger.warn(`[PrepList] Prep ${item.name} has no originalPrep.unit, falling back to component's unit kind: ${String(prepMeasureKind)}`);
          } // If not a preparation, prepMeasureKind remains null, modal won't be restricted by prep's type

          // Amount of this preparation component used in the current dish (base, unscaled)
          const baseAmountOfPrepInDishStr = String(item.amount ?? '');
          const baseAmountOfPrepInDishNum = parseFloat(baseAmountOfPrepInDishStr);

          // Preparations are unitless; base scale is always 1
          const prepOriginalYieldAmountValue = 1;

          // Construct necessary details for PreparationCard
          // Note: We might not have full sub-ingredient details here unless fetched/passed
          const pseudoPreparationDetails: Preparation = {
            preparation_id: item.ingredient_id || '',
            name: item.name,
            directions: item.prepStateInstructions ? item.prepStateInstructions.join('\n') : null,
            total_time: null, // Not typically available directly in ComponentInput
            ingredients: (item.prepStateEditableIngredients || []).map(subIng => { // Use stored state if available
              // preparations in this context are unitless; we set unit null intentionally
              // const subUnit = units.find(u => u.unit_id === subIng.unitId);
              const subAmount = parseFloat(subIng.amountStr);
              return {
                preparation_id: item.ingredient_id || '',
                ingredient_id: subIng.ingredient_id || subIng.name, // Use name as fallback ID
                name: capitalizeWords(subIng.name),
                amount: isNaN(subAmount) ? null : subAmount,
                unit: null,
              };
            }),
            cooking_notes: null // Not typically available directly
          };

          const componentForCard: DishComponent = {
            dish_id: '', // Placeholder
            ingredient_id: item.ingredient_id || '',
            name: item.name,
            amount: isNaN(baseAmountOfPrepInDishNum) ? null : baseAmountOfPrepInDishNum, // This is correct: amount of prep in dish
            unit: null,
            isPreparation: true,
            preparationDetails: pseudoPreparationDetails, // Use the constructed details
            rawIngredientDetails: null
          };

          const currentRecipeScale = (originalServings && numServings && originalServings > 0)
            ? numServings / originalServings
            : 1;

          // Scaled amount of THIS PREPARATION used in the CURRENT DISH
          const scaledAmountOfPrepInDish = isNaN(baseAmountOfPrepInDishNum) ? null : baseAmountOfPrepInDishNum * currentRecipeScale;
          // Display as unitless multiplier (no unit abbreviation)
          const displayAmountStr = isNaN(baseAmountOfPrepInDishNum) ? '' : String(baseAmountOfPrepInDishNum);

          appLogger.log(`[PrepList] ${item.name}: baseAmountInDish=${baseAmountOfPrepInDishStr}, scale=${currentRecipeScale.toFixed(2)}, scaledInDish=${displayAmountStr}, prepOriginalYield=${prepOriginalYieldAmountValue}`);

          const handleAmountInputChange = (value: string) => {
            const num = parseFloat(value);
            if (!isNaN(num) && currentRecipeScale !== 0) {
              // De-scale the input value to get the base amount
              let baseAmountToNormalize = num / currentRecipeScale;

              // No unit normalization needed for multipliers

              // Update the base amount
              onUpdate(itemKey, 'amount', String(baseAmountToNormalize));
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
                  value={displayAmountStr}
                  onChangeText={handleAmountInputChange}
                  key={`prep-amount-${itemKey}`}
                  keyboardType="numeric"
                />
                <Text style={styles.multiplierLabel}>×</Text>
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
  multiplierLabel: {
    ...FONTS.body3,
    color: COLORS.text,
    marginLeft: SIZES.base / 2,
    marginRight: SIZES.base,
  },
});

export default PreparationListComponent; 