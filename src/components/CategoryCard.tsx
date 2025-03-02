import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name={category.icon as any} size={30} color={COLORS.white} />
      </View>
      <Text style={styles.title}>{category.name}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '45%',
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
});

export default CategoryCard;