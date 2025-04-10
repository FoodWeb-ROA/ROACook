import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Category } from '../types';
import { COLORS, SIZES, SHADOWS, GRADIENTS } from '../constants/theme';

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
      <LinearGradient
        colors={GRADIENTS.secondary}
        style={StyleSheet.absoluteFill}
      />
      {category.icon && (
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name={category.icon as any} size={30} color={COLORS.white} />
        </View>
      )}
      <Text style={styles.title}>{category.name}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: SIZES.radius * 1.5,
    paddingVertical: SIZES.padding * 1.5,
    paddingHorizontal: SIZES.padding,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
    minHeight: 120,
    overflow: 'hidden',
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
    fontSize: SIZES.medium,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
    marginTop: SIZES.base,
  },
});

export default CategoryCard;