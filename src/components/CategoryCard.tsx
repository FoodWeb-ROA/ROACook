import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { Category } from '../types';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CategoryCardProps {
  category: Category;
  onPress: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onRenameRequest: (category: Category) => void;
  // onRename: (category: Category) => void; // For future implementation
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, onPress, onDelete, onRenameRequest }) => {
  const { t } = useTranslation();
  const { showActionSheetWithOptions } = useActionSheet();

  const handleOpenMenu = () => {
    const options = [
      t('common.rename', 'Rename'),
      t('common.delete', 'Delete'),
      t('common.cancel', 'Cancel'),
    ];
    const destructiveButtonIndex = 1; // 'Delete'
    const cancelButtonIndex = 2; // 'Cancel'

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
        title: category.name,
        // message: t('categoryCard.menuMessage', 'Select an action'), // Optional message
        tintColor: COLORS.primary, // Optional: for iOS action sheet icon/text color
      },
      (selectedIndex?: number) => {
        switch (selectedIndex) {
          case 0: // Rename
            onRenameRequest(category);
            break;
          case 1: // Delete
            Alert.alert(
              t('common.confirmDelete', 'Confirm Delete'),
              t('categoryCard.deleteConfirmation', {
                categoryName: category.name,
                defaultValue: `Are you sure you want to delete '${category.name}'?`,
              }),
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
            break;
          // case 2 (Cancel) is handled by the action sheet itself
        }
      }
    );
  };

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress(category)}
      activeOpacity={0.8}
    >
      <Text style={styles.title}>{category.name}</Text>

      <TouchableOpacity onPress={handleOpenMenu} style={styles.menuButton}>
        <MaterialCommunityIcons name="dots-horizontal" size={24} color={COLORS.white} />
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
    overflow: 'visible',
  },
  title: {
    fontSize: SIZES.medium,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
    width: '100%', 
  },
  menuButton: {
    position: 'absolute',
    top: SIZES.padding / 2,
    right: SIZES.padding / 2,
    padding: 0, 
  },
});

export default CategoryCard;