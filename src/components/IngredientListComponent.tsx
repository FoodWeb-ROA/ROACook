import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { Unit, ComponentInput, EditablePrepIngredient } from '../types'; // Include both types
import { formatQuantityAuto, capitalizeWords } from '../utils/textFormatters';

// Accept either ComponentInput (from CreateRecipe) or EditablePrepIngredient (from CreatePreparation)
type IngredientItem = ComponentInput | EditablePrepIngredient;

interface IngredientListComponentProps {
  ingredients: IngredientItem[];
  units: Unit[];
  pieceUnitId: string | null;
  scaleMultiplier?: number; // Optional for scaling display (CreatePrep)
  originalServings?: number; // Optional for scaling display (CreateRecipe)
  numServings?: number;     // Optional for scaling display (CreateRecipe)
  onUpdate: (key: string, field: 'amount' | 'amountStr' | 'unitId' | 'item' | 'scaledAmountStr', value: string | null) => void;
  onRemove: (key: string) => void;
  onSelectUnit: (key: string) => void; // Callback to open unit modal in parent
  amountLabel?: string; // Optional label for amount column (e.g., "Base Amount", "Scaled Amount")
  isPrepScreen?: boolean; // Flag to differentiate behavior slightly if needed
}

const IngredientListComponent: React.FC<IngredientListComponentProps> = ({
  ingredients,
  units,
  pieceUnitId,
  scaleMultiplier = 1, // Default scale to 1 if not provided
  originalServings,
  numServings,
  onUpdate,
  onRemove,
  onSelectUnit,
  amountLabel, // Use the passed label
  isPrepScreen = false, // Default to false
}) => {
  console.log('--- IngredientListComponent: passed ingredients:', ingredients);

  const { t } = useTranslation();

  // Helper to get string amount, handling both types
  const getAmountStr = (item: IngredientItem): string => {
    return 'amountStr' in item ? item.amountStr : (item.amount ?? '');
  };

  // Helper to get unitId, handling both types
  const getUnitId = (item: IngredientItem): string | null => {
    return 'unitId' in item ? item.unitId : (item.unit_id ?? null);
  };

  // Helper to get item description, handling both types
  const getItemDesc = (item: IngredientItem): string | null => {
    return 'item' in item ? (item.item ?? null) : null;
  };

  return (
    <View>
      {ingredients.length === 0 ? (
         <Text style={styles.emptyListText}>
             {isPrepScreen 
                 ? t('screens.createPreparation.noSubIngredients', 'No ingredients listed for this preparation.') 
                 : t('screens.createRecipe.noRawIngredients', 'No raw ingredients added yet.')}
         </Text>
      ) : (
        ingredients.map((item) => {
            const itemKey = item.key;
            const itemUnitId = getUnitId(item);
            const itemDesc = getItemDesc(item);
            const baseAmountStr = getAmountStr(item);
            const baseAmountNum = parseFloat(baseAmountStr);
            const unit = units.find(u => u.unit_id === itemUnitId);
            const unitAbbr = unit?.abbreviation || t('common.unit', 'Unit');

            // Determine the scale factor based on context
            const currentRecipeScale = (originalServings && numServings && originalServings > 0) 
                                       ? numServings / originalServings 
                                       : scaleMultiplier; // Use scaleMultiplier if recipe servings unavailable
                                       
            const scaledAmount = isNaN(baseAmountNum) ? null : baseAmountNum * currentRecipeScale;
            const formattedDisplay = formatQuantityAuto(scaledAmount, unitAbbr, itemDesc || undefined);

            return (
              <View key={itemKey} style={styles.componentItemContainer}>
                 <Text style={styles.componentNameText}>
                     {capitalizeWords(item.name)}
                 </Text>
                 {/* Wrapper for controls on the right */}
                 <View style={styles.controlsWrapper}>
                    {/* Row 1: Amount, Unit, Remove */}
                    <View style={styles.controlsRow1}>
                         <TextInput
                             style={styles.componentInputAmount}
                             placeholder={t('common.amount')}
                             placeholderTextColor={COLORS.placeholder}
                             value={isPrepScreen ? formattedDisplay.amount : baseAmountStr}
                             onChangeText={(value) => onUpdate(itemKey, isPrepScreen ? 'scaledAmountStr' : 'amount', value)}
                             keyboardType="numeric"
                         />
                         <TouchableOpacity
                             style={[styles.componentUnitTrigger, { marginLeft: SIZES.base }]}
                             onPress={() => onSelectUnit(itemKey)} // Trigger parent modal
                         >
                             <Text style={[styles.pickerText, !itemUnitId && styles.placeholderText]}>
                                 {unitAbbr}
                             </Text>
                              <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => onRemove(itemKey)} style={styles.removeButton}>
                             <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                         </TouchableOpacity>
                    </View>

                    {/* Row 2: Item Input (Conditional) */}
                    {itemUnitId === pieceUnitId && (
                        <View style={styles.controlsRow2}> 
                             <TextInput
                                style={styles.itemInput}
                                placeholder={t('screens.createRecipe.servingItemPlaceholder')} 
                                placeholderTextColor={COLORS.placeholder}
                                value={itemDesc || ''}
                                onChangeText={(value) => onUpdate(itemKey, 'item', value)}
                             />
                        </View>
                     )}
                 </View>
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
  componentItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding / 2, // Reduced padding for tighter list
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SIZES.base,
  },
  componentNameText: {
    ...FONTS.body3,
    color: COLORS.text,
    flex: 0.4, // Adjust flex ratio if needed
    marginRight: SIZES.base,
  },
  componentControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.6, // Adjust flex ratio if needed
    justifyContent: 'flex-end',
  },
  controlsWrapper: {
    flex: 0.6, // Takes up the right portion
    flexDirection: 'column',
    alignItems: 'flex-end', // Align controls to the right
  },
  controlsRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', // Keep controls packed right
    width: '100%', // Ensure row takes full width of wrapper
  },
  controlsRow2: {
    marginTop: SIZES.base / 2, // Add space above item input
    justifyContent: 'flex-end', // Push content (itemInput + its margin) to the right
    width: '100%', // Ensure it spans the wrapper width to allow justifyContent to work
  },
  componentInputAmount: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: SIZES.font,
    textAlign: 'right',
    marginRight: 32, // Add margin equal to remove button space (approx 8 + 24)
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
    width: 80, // INCREASED fixed width
    marginLeft: SIZES.base, // Add margin for spacing
    justifyContent: 'space-between',
  },
  pickerText: {
    ...FONTS.body3,
    color: COLORS.text,
    marginRight: 4,
    fontSize: SIZES.font,
    textAlign: 'right',
  },
  placeholderText: {
    color: COLORS.placeholder,
  },
  itemInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: SIZES.font,
    textAlign: 'right',
  },
  removeButton: {
    paddingLeft: SIZES.base,
    marginLeft: SIZES.base, // Ensure space before remove button
  },
});

export default IngredientListComponent; 