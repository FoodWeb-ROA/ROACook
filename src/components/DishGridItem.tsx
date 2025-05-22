import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Dish } from '../types';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { appLogger } from '../services/AppLogService';

interface DishGridItemProps {
  dish: Dish;
  onPress: (dish: Dish) => void;
}

const DishGridItem: React.FC<DishGridItemProps> = ({ dish, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(dish)}
      activeOpacity={0.8}
    >
      <Text style={styles.title} numberOfLines={1}>{dish.dish_name}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius * 2.5,
    paddingVertical: SIZES.small,
    paddingHorizontal: SIZES.medium,
    ...SHADOWS.small,
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: 50,
  },
  title: {
    fontSize: SIZES.font * 0.8,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
});

export default DishGridItem;