import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { Unit, Preparation, ComponentInput, DishComponent } from '../types';
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
  onSelectUnit: (key: string) => void;
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
          const baseAmountStr = String(item.amount ?? '');
          const baseAmountNum = parseFloat(baseAmountStr);


          // Construct necessary details for PreparationCard
          // Note: We might not have full sub-ingredient details here unless fetched/passed
          // const pseudoPreparationDetails: Preparation = {
          //   preparation_id: item.ingredient_id,
          //   name: item.name,
          //   directions: item.prepStateInstructions ? item.prepStateInstructions.join('\n') : null,
          //   total_time: null, // Not typically available directly in ComponentInput
          //   yield_unit: prepUnit || null,
          //   yield_amount: isNaN(prepAmountNum) ? null : prepAmountNum,
          //   ingredients: (item.prepStateEditableIngredients || []).map(subIng => { // Use stored state if available
          //     const subUnit = units.find(u => u.unit_id === subIng.unitId);
          //     const subAmount = parseFloat(subIng.amountStr);
          //     return {
          //       preparation_id: item.ingredient_id,
          //       ingredient_id: subIng.ingredient_id || subIng.name, // Use name as fallback ID
          //       name: capitalizeWords(subIng.name),
          //       amount: isNaN(subAmount) ? null : subAmount,
          //       unit: subUnit || null
          //     };
          //   }),
          //   cooking_notes: null // Not typically available directly
          // };
          const pseudoPreparationDetails: Preparation = {
            preparation_id: item.ingredient_id,
            name: item.name,
            directions: item.prepStateInstructions ? item.prepStateInstructions.join('\n') : null,
            total_time: null,
            yield_unit: unit || null,
            yield_amount: isNaN(baseAmountNum) ? null : baseAmountNum,
            ingredients: (item.prepStateEditableIngredients || []).map(subIng => {
                const subUnit = units.find(u => u.unit_id === subIng.unitId);
                 const subAmount = parseFloat(subIng.amountStr);
                 return {
                     preparation_id: item.ingredient_id,
                     ingredient_id: subIng.ingredient_id || subIng.name,
                     name: capitalizeWords(subIng.name),
                     amount: isNaN(subAmount) ? null : subAmount,
                     unit: subUnit || null
                 };
             }),
            cooking_notes: null
          };

          // const componentForCard: DishComponent = {
          //   dish_id: '', // Placeholder
          //   ingredient_id: item.ingredient_id,
          //   name: item.name,
          //   amount: isNaN(prepAmountNum) ? null : prepAmountNum,
          //   unit: prepUnit || null,
          //   isPreparation: true,
          //   preparationDetails: pseudoPreparationDetails, // Use the constructed details
          //   rawIngredientDetails: null
          // };
          const componentForCard: DishComponent = {
            dish_id: '',
            ingredient_id: item.ingredient_id,
            name: item.name,
            amount: isNaN(baseAmountNum) ? null : baseAmountNum, 
            unit: unit || null, 
            isPreparation: true,
            preparationDetails: pseudoPreparationDetails,
            rawIngredientDetails: null
          };

          // const currentScale = originalServings > 0 ? numServings / originalServings : 1;
          const currentRecipeScale = (originalServings && numServings && originalServings > 0)
            ? numServings / originalServings
            : 1;

          return (
            <View key={item.key} style={styles.preparationCardContainer}>
              <PreparationCard
                amountLabel={t('common.amount', 'Amount')}
                component={componentForCard}
                onPress={() => onSelectPrep(item)}
                // scaleMultiplier={currentScale}
                scaleMultiplier={currentRecipeScale}
              />

              <View style={styles.amountUnitRow}>
                    <TextInput
                        style={styles.componentInputAmount}
                        placeholder={t('common.amount')}
                        placeholderTextColor={COLORS.placeholder}
                        value={baseAmountStr}
                        onChangeText={(value) => onUpdate(itemKey, 'amount', value)} 
                        keyboardType="numeric"
                    />
                    <TouchableOpacity
                        style={[styles.componentUnitTrigger, { marginLeft: SIZES.base }]}
                        onPress={() => onSelectUnit(itemKey)} 
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