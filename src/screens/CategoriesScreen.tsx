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
import { Category } from '../types';
import CategoryCard from '../components/CategoryCard';
import AddCategoryCard from '../components/AddCategoryCard';
import AppHeader from '../components/AppHeader';
import { useMenuSections } from '../hooks/useSupabase';

type CategoriesScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const CategoriesScreen = () => {
  const navigation = useNavigation<CategoriesScreenNavigationProp>();
  const { menuSections, loading, error } = useMenuSections();
  
  // Map menu sections to the format expected by CategoryCard
  const categories = menuSections?.map(section => ({
    menu_section_id: section.menu_section_id,
    name: section.name,
    icon: 'silverware-fork-knife' // Default icon
  })) || [];

  const handleCategoryPress = (category: Category) => {
    navigation.navigate('CategoryRecipes', {
      categoryId: category.menu_section_id,
      categoryName: category.name,
    });
  };

  const handleAddSection = (sectionName: string) => {
    // Cross-platform alert handling
    if (Platform.OS === 'web') {
      window.alert(`Section "${sectionName}" has been added.`);
    } else {
      // React Native's Alert for iOS/Android
      Alert.alert(
        "New Section Added",
        `Section "${sectionName}" has been added.`,
        [{ text: "OK" }]
      );
    }
    
    // In a real app, you would add the new section to the database
    // For now, we'll just show the alert
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader 
        title="Recipe Categories"
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
            {categories.map(category => (
              <CategoryCard
                key={category.menu_section_id}
                category={category}
                onPress={handleCategoryPress}
              />
            ))}
            
            {/* Add Category Card - explicitly rendered */}
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