import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Category } from '../types';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

interface CategoryCardProps {
  category: Category;
  onPress: (category: Category) => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress(category)}
      activeOpacity={0.8}
    >
      <Text style={styles.title}>{category.name}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius * 3,
    paddingVertical: SIZES.padding * 1.5,
    paddingHorizontal: SIZES.padding,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
    minHeight: 130,
  },
  title: {
    fontSize: SIZES.medium,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
    width: '100%',
  },
});

export default CategoryCard;