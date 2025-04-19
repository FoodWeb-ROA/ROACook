import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ParsedIngredient } from '../types'; // Import ParsedIngredient type
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';

interface ParsedPreparationCardProps {
  preparation: ParsedIngredient; // Expects a ParsedIngredient which is a Preparation
  onPress: () => void;
}

const ParsedPreparationCard: React.FC<ParsedPreparationCardProps> = ({ preparation, onPress }) => {
  // Basic check if it's indeed a preparation type, although filtering happens upstream
  if (preparation.ingredient_type !== 'Preparation') {
    return null; // Or render an error/placeholder
  }

  // Helper to format ingredient details
  const formatIngredient = (ing: any) => { // Use 'any' for sub-ingredients for now, refine if needed
      const amountStr = (ing.amount ?? 0) % 1 === 0 ? (ing.amount ?? 0).toString() : (ing.amount ?? 0).toFixed(1);
      const unitStr = ing.unit || '';
      return `• ${ing.name || 'Unknown'}: ${amountStr} ${unitStr}`;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{preparation.name || 'Unnamed Preparation'}</Text>
        <Text style={styles.usageText}>
            Used: {preparation.amount ?? 'N/A'} {preparation.unit ?? ''}
        </Text>
      </View>

      {/* Display sub-ingredients */}
       <Text style={styles.subTitle}>Contains:</Text>
      {preparation.ingredients && preparation.ingredients.length > 0 ? (
        preparation.ingredients.map((ing: any, index: number) => (
          <Text key={index} style={styles.ingredientText}>
            {formatIngredient(ing)}
          </Text>
        ))
      ) : (
        <Text style={styles.noIngredientsText}>No sub-ingredients listed.</Text>
      )}

      {/* Add an indicator that it's clickable */}
      <View style={styles.detailsIndicator}>
        <Text style={styles.detailsText}>View Details</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.primary} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.secondary, // Use secondary for distinction
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.base,
    ...SHADOWS.small,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary, // Accent to show it's special
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  title: {
    ...FONTS.h4, // Slightly smaller than PrepCard title
    color: COLORS.white,
    flex: 1, // Allow title to wrap if needed
    marginRight: SIZES.base,
  },
  usageText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  subTitle: {
    ...FONTS.body3,
    color: COLORS.text,
    marginTop: SIZES.base,
    marginBottom: SIZES.base / 2,
    fontWeight: '600',
  },
  ingredientText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginLeft: SIZES.base,
    marginBottom: SIZES.base / 4,
  },
  noIngredientsText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    fontStyle: 'italic',
    marginLeft: SIZES.base,
  },
  detailsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: SIZES.base,
  },
  detailsText: {
    ...FONTS.body3,
    color: COLORS.primary,
    marginRight: SIZES.base / 2,
  },
});

export default ParsedPreparationCard; 