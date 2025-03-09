import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { CATEGORIES } from '../constants/dummyData';
import { RootStackParamList } from '../navigation/types';
import { Category } from '../types';
import CategoryCard from '../components/CategoryCard';
import AddCategoryCard from '../components/AddCategoryCard';
import AppHeader from '../components/AppHeader';

type CategoriesScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const CategoriesScreen = () => {
  const navigation = useNavigation<CategoriesScreenNavigationProp>();
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);

  const handleCategoryPress = (category: Category) => {
    navigation.navigate('CategoryRecipes', {
      categoryId: category.id,
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
    // and update the state with the new section
    // For now, we'll just add it to the local state
    const newSection: Category = {
      id: `${Date.now()}`, // Simple temporary ID
      name: sectionName,
      icon: 'folder', // Default icon
    };
    
    setCategories([...categories, newSection]);
  };

  // When working with FlatList and numColumns, we need to ensure
  // the data array length is properly padded to ensure grid layout works correctly
  
  // Debug to see what's actually being rendered
  console.log("Rendering categories:", categories.length, "items");
  
  // Create a dummy category for the add button that will be recognized by the renderItem function
  const addButtonCategory: Category = { 
    id: 'add-button', 
    name: 'New Section', 
    icon: 'plus-circle' 
  };
  
  // Include the add button as the last item
  const dataWithAddButton = [...categories, addButtonCategory];
  
  const renderItem = ({ item, index }: { item: Category; index: number }) => {
    // Render the add button card for the special ID
    if (item.id === 'add-button') {
      console.log("Rendering add button at index", index);
      return <AddCategoryCard onAdd={handleAddSection} />;
    }
    
    // Render regular category card
    return (
      <CategoryCard
        category={item}
        onPress={handleCategoryPress}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader 
        title="Recipe Categories"
        showBackButton={false}
      />
      
      {/* For web compatibility, let's use a ScrollView with flexbox grid */}
      <ScrollView contentContainerStyle={styles.listContent}>
        <View style={styles.categoriesGrid}>
          {categories.map(category => (
            <CategoryCard
              key={category.id}
              category={category}
              onPress={handleCategoryPress}
            />
          ))}
          
          {/* Add Category Card - explicitly rendered */}
          <AddCategoryCard onAdd={handleAddSection} />
        </View>
      </ScrollView>
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
  categoriesRow: {
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
  },
});

export default CategoriesScreen;