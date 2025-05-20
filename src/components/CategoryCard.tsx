import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { Category } from '../types';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CategoryCardProps {
  category: Category;
  onPress: (category: Category) => void;
  onDelete: (categoryId: string) => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, onPress, onDelete }) => {
  const { t } = useTranslation();

  const handleDelete = () => {
    Alert.alert(
      t('common.confirmDelete', 'Confirm Delete'),
      category.name,
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: () => onDelete(category.menu_section_id),
        },
      ]
    );
  };

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress(category)}
      activeOpacity={0.8}
    >
      <Text style={styles.title}>{category.name}</Text>

      <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
        <MaterialCommunityIcons name="delete" size={20} color={COLORS.error} />
      </TouchableOpacity>
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
    position: 'relative',
    overflow: 'hidden'
  },
  title: {
    fontSize: SIZES.medium,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
    width: '100%',
  },
  deleteButton: {
    position: 'absolute',
    bottom: SIZES.padding,
    right: SIZES.padding,
    width: SIZES.base * 4,
    height: SIZES.base * 4,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default CategoryCard;