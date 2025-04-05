import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Recipe } from '../types';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

interface RecipeGridItemProps {
  recipe: Recipe;
  onPress: (recipe: Recipe) => void;
}

const RecipeGridItem: React.FC<RecipeGridItemProps> = ({ recipe, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress(recipe)}
      activeOpacity={0.8}
    >
      <Text style={styles.title} numberOfLines={1}>{recipe.recipe_name}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.small,
    paddingHorizontal: SIZES.medium,
    ...SHADOWS.small,
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: 50,
  },
  title: {
    fontSize: SIZES.font,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'left',
  },
});

export default RecipeGridItem;