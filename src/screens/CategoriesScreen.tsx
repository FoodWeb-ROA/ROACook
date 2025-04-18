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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { MenuSection } from '../types';
import CategoryCard from '../components/CategoryCard';
import AddCategoryCard from '../components/AddCategoryCard';
import AppHeader from '../components/AppHeader';
import { useMenuSections } from '../hooks/useSupabase';
import { supabase } from '../data/supabaseClient';

type CategoriesScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const CategoriesScreen = () => {
  const navigation = useNavigation<CategoriesScreenNavigationProp>();
  const { menuSections, loading, error, refresh } = useMenuSections();
  
  const handleCategoryPress = (category: MenuSection) => {
    navigation.navigate('CategoryRecipes', {
      categoryId: category.menu_section_id,
      categoryName: category.name,
    });
  };

  const handleAddSection = async (sectionName: string) => {
    try {
      // TODO: Replace placeholder with actual logic to get kitchen_id
      const placeholderKitchenId = 'YOUR_DEFAULT_KITCHEN_ID_HERE'; 
      if (placeholderKitchenId === 'YOUR_DEFAULT_KITCHEN_ID_HERE') {
          console.warn('Using placeholder kitchen ID in handleAddSection (CategoriesScreen)');
      }

      const { data, error } = await supabase
        .from('menu_section')
        // Provide the required kitchen_id
        .insert({ name: sectionName, kitchen_id: placeholderKitchenId }) 
        .select()
        .single();
      
      if (error) throw error;
      
      // Cross-platform alert handling
      if (Platform.OS === 'web') {
        window.alert(`Section "${sectionName}" has been added successfully.`);
      } else {
        // React Native's Alert for iOS/Android
        Alert.alert(
          "Success",
          `Section "${sectionName}" has been added successfully.`,
          [{ text: "OK" }]
        );
      }
      
      // Refresh the menu sections list
      refresh();
    } catch (error: any) {
      console.error('Error adding section:', error);
      
      // Cross-platform error alert
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader 
        title="Categories"
        showBackButton={true}
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <Text style={styles.errorText}>Error loading categories</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={styles.categoriesGrid}>
            {menuSections?.map(section => (
              <CategoryCard
                key={section.menu_section_id}
                category={section}
                onPress={handleCategoryPress}
              />
            ))}
            
            <AddCategoryCard onAdd={handleAddSection} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SIZES.padding * 2,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SIZES.padding,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.error,
    textAlign: 'center',
    padding: SIZES.padding * 2,
  },
});

export default CategoriesScreen;