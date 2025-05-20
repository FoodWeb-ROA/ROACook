import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Dish } from '../types';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { appLogger } from '../services/AppLogService';

interface DishGridItemProps {
  dish: Dish;
  onPress: (dish: Dish) => void;
  onDelete?: (dishId: string) => void;
}

const DishGridItem: React.FC<DishGridItemProps> = ({ dish, onPress, onDelete }) => {
  const { t } = useTranslation();

  const handleDelete = () => {
    if (onDelete) {
      Alert.alert(
        t('common.confirmDelete', 'Confirm Delete'),
        dish.dish_name,
        [
          {
            text: t('common.cancel', 'Cancel'),
            style: 'cancel',
          },
          {
            text: t('common.delete', 'Delete'),
            style: 'destructive',
            onPress: () => onDelete(dish.dish_id),
          },
        ]
      );
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(dish)}
      activeOpacity={0.8}
    >
      <Text style={styles.title} numberOfLines={1}>{dish.dish_name}</Text>
      {onDelete && (
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
          <MaterialCommunityIcons name="delete" size={20} color={COLORS.error} />
        </TouchableOpacity>
      )}
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
    position: 'relative'
  },
  title: {
    fontSize: SIZES.font * 0.8,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
  deleteButton: {
    position: 'absolute',
    right: SIZES.small,
    width: SIZES.base * 4,
    height: SIZES.base * 4,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default DishGridItem; 