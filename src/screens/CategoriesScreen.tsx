import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  TextInput
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { MenuSection } from '../types';
import CategoryCard from '../components/CategoryCard';
import AddCategoryCard from '../components/AddCategoryCard';
import AppHeader from '../components/AppHeader';
import { useMenuSections } from '../hooks/useSupabase';
import { supabase } from '../data/supabaseClient';
import { useTranslation } from 'react-i18next';
import { appLogger } from '../services/AppLogService';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

type CategoriesScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const CategoriesScreen = () => {
  const navigation = useNavigation<CategoriesScreenNavigationProp>();
  const { menuSections, isLoading, error, refresh } = useMenuSections();
  const { t } = useTranslation();
  const activeKitchenId = useSelector((state: RootState) => state.kitchens.activeKitchenId);
  
  const handleCategoryPress = (category: MenuSection) => {
    navigation.navigate('CategoryRecipes', {
      categoryId: category.menu_section_id,
      categoryName: category.name,
    });
  };

  const [editingCategory, setEditingCategory] = useState<MenuSection | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      if (!activeKitchenId) {
        Alert.alert(
          t('errors.errorTitle'),
          t('errors.noActiveKitchenForSection')
        );
        return;
      }

      const { error } = await supabase
        .from('menu_section')
        .delete()
        .eq('menu_section_id', categoryId)
        .eq('kitchen_id', activeKitchenId);

      if (error) throw error;

      await refresh();
      
    } catch (error: any) {
      appLogger.error('Error deleting category:', error);
      Alert.alert(
        t('errors.errorTitle'),
        t('errors.deleteCategoryError', { error: error.message || String(error) })
      );
    }
  };

  const handleRenameRequest = (category: MenuSection) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setShowRenameModal(true);
  };

  const handleRenameCategory = async () => {
    if (!editingCategory || !newCategoryName.trim()) {
      setShowRenameModal(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('menu_section')
        .update({ name: newCategoryName.trim() })
        .eq('menu_section_id', editingCategory.menu_section_id);

      if (error) throw error;

      await refresh();
      setShowRenameModal(false);
      
    } catch (error: any) {
      appLogger.error('Error renaming category:', error);
      Alert.alert(
        t('errors.errorTitle'),
        t('errors.renameCategoryError', { error: error.message || String(error) })
      );
    }
  };

  const handleAddSection = async (sectionName: string) => {
    try {
      if (!activeKitchenId) {
        appLogger.error('handleAddSection: No active kitchen ID found. Cannot add section.');
        Alert.alert(
          t('errors.errorTitle'), 
          t('errors.noActiveKitchenForSection') 
        );
        return;
      }

      appLogger.log(`handleAddSection: Adding section '${sectionName}' to kitchen ${activeKitchenId}`);

      const { data, error } = await supabase
        .from('menu_section')
        .insert({ name: sectionName, kitchen_id: activeKitchenId }) 
        .select()
        .single();
      
      if (error) throw error;
      
      await refresh();
      
    } catch (error: any) {
      appLogger.error('Error adding section:', error);
      
      if (Platform.OS === 'web') {
        window.alert(`Failed to add section "${sectionName}". Please try again. Error: ${error.message || String(error)}`);
      } else {
        Alert.alert(
          "Error",
          `Failed to add section "${sectionName}". Please try again. Error: ${error.message || String(error)}`,
          [{ text: "OK" }]
        );
      }
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title={t('screens.categories.loading')} showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.errorContainer]}>
        <StatusBar style="light" />
        <AppHeader title={t('screens.categories.error')} showBackButton={true} />
        <Text style={styles.errorText}>{error.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <AppHeader 
        title={t('screens.categories.title')}
        showBackButton={true}
      />
      
      <ScrollView contentContainerStyle={styles.listContent}>
        <View style={styles.categoriesGrid}>
          {menuSections?.map(section => (
            <CategoryCard
              key={section.menu_section_id}
              category={section}
              onPress={handleCategoryPress}
              onDelete={handleDeleteCategory}
              onRenameRequest={handleRenameRequest}
            />
          ))}
          
          <AddCategoryCard onAdd={handleAddSection} />
        </View>
      </ScrollView>

      {/* Rename Category Modal */}
      {showRenameModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {t('screens.categories.renameCategory')}
            </Text>
            <TextInput
              style={styles.input}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder={t('screens.categories.categoryNamePlaceholder')}
              autoFocus
              onSubmitEditing={handleRenameCategory}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowRenameModal(false)}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleRenameCategory}
                disabled={!newCategoryName.trim()}
              >
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  listContent: {
    padding: SIZES.padding * 2,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start', 
    gap: SIZES.padding,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.error,
    textAlign: 'center',
    padding: SIZES.padding * 2,
  },
  // Modal Styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    width: '80%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    padding: SIZES.padding * 2,
    ...SHADOWS.large,
  },
  modalTitle: {
    ...FONTS.h3,
    marginBottom: SIZES.padding,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
    ...FONTS.body3,
    color: COLORS.black, // Changed text color to black
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SIZES.padding,
  },
  modalButton: {
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
    marginLeft: SIZES.base,
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButtonText: {
    ...FONTS.body3,
    color: COLORS.textLight,
  },
  saveButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
  },
});

export default CategoriesScreen;