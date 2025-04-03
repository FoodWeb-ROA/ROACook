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
      <Text style={styles.title} numberOfLines={2}>{recipe.recipe_name}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '48%',
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
    ...SHADOWS.small,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 80,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
});

export default RecipeGridItem;