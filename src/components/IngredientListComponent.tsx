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
                 <View style={styles.componentControlsContainer}>
                     {/* Amount Input: Behavior depends on context */}
                     <TextInput
                         style={styles.componentInputAmount}
                         placeholder={t('common.amount')}
                         placeholderTextColor={COLORS.placeholder}
                         // In PrepScreen, edit scaled amount; In RecipeScreen, edit base amount
                         value={isPrepScreen ? formattedDisplay.amount : baseAmountStr}
                         onChangeText={(value) => onUpdate(itemKey, isPrepScreen ? 'scaledAmountStr' : 'amount', value)}
                         keyboardType="numeric"
                     />
                     {/* Unit selector */}
                     <TouchableOpacity
                         style={[styles.componentUnitTrigger, { marginLeft: SIZES.base }]}
                         onPress={() => onSelectUnit(itemKey)} // Trigger parent modal
                     >
                         <Text style={[styles.pickerText, !itemUnitId && styles.placeholderText]}>
                             {unitAbbr}
                         </Text>
                          <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                     </TouchableOpacity>

                     {/* Conditionally Render Item Input */}
                     {itemUnitId === pieceUnitId && (
                        <TextInput
                           style={styles.itemInput}
                           placeholder={t('screens.createRecipe.servingItemPlaceholder', '(e.g., large)')} // Reused key
                           placeholderTextColor={COLORS.placeholder}
                           value={itemDesc || ''}
                           onChangeText={(value) => onUpdate(itemKey, 'item', value)}
                        />
                     )}

                     {/* Remove Button */}
                     <TouchableOpacity onPress={() => onRemove(itemKey)} style={[styles.removeButton, itemUnitId !== pieceUnitId && { marginLeft: SIZES.base } ]}>
                         <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                     </TouchableOpacity>
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
  componentInputAmount: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 60, // Increased minWidth slightly
    textAlign: 'right',
    fontSize: SIZES.font,
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
    minWidth: 60, // Match input width
    justifyContent: 'space-between',
  },
  pickerText: {
    ...FONTS.body3,
    color: COLORS.text,
    marginRight: 4,
  },
  placeholderText: {
    color: COLORS.placeholder,
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
    marginRight: SIZES.base,
  },
  removeButton: {
    paddingLeft: SIZES.base,
  },
});

export default IngredientListComponent; 