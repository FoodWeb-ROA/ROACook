import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { StackNavigationProp } from '@react-navigation/stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useActionSheet } from '@expo/react-native-action-sheet';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { DrawerParamList } from '../navigation/AppNavigator';
import { Category, Recipe } from '../types';
import CategoryCard from '../components/CategoryCard';
import AddCategoryCard from '../components/AddCategoryCard';
import RecipeGridItem from '../components/RecipeGridItem';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { useMenuSections, useRecipes } from '../hooks/useSupabase';
import { supabase } from '../data/supabaseClient';

// Helper function to chunk array with type annotations
const chunk = <T,>(array: T[], size: number): T[][] => { // Add generic type T and return type T[][]
  if (!array) return [];
  const firstChunk = array.slice(0, size);
  if (!firstChunk.length) {
    // Handle case where array is smaller than size or empty
    return array.length > 0 ? [array] : []; 
  }
  // Recursively chunk the rest
  const rest: T[][] = chunk(array.slice(size), size); // Explicitly type the result of the recursive call
  return [firstChunk].concat(rest);
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// --- Category Grid Constants ---
const CATEGORIES_PER_PAGE = 4;
const CATEGORY_NUM_COLUMNS = 2;
const CAT_PADDING = SIZES.padding * 2; // Padding inside category pages
const CAT_ITEM_SPACING = SIZES.padding; 
const catAvailableWidthInPage = screenWidth - CAT_PADDING * 2;
const categoryItemWidth = (catAvailableWidthInPage - CAT_ITEM_SPACING * (CATEGORY_NUM_COLUMNS - 1)) / CATEGORY_NUM_COLUMNS;
const CAT_PAGE_WIDTH = screenWidth;

// --- Recipe Grid Constants (2x4 Paging) ---
const RECIPES_PER_PAGE = 8; // 2 columns * 4 rows
const RECIPE_NUM_COLUMNS = 2;
const RECIPE_PADDING = SIZES.padding; // Padding inside recipe pages
const RECIPE_ITEM_SPACING = SIZES.padding; // Spacing between items
// Recalculate width available inside recipe page padding
const recipeAvailableWidthInPage = screenWidth - RECIPE_PADDING * 2;
// Recalculate width for each recipe item (2 columns)
const recipeItemWidth = (recipeAvailableWidthInPage - RECIPE_ITEM_SPACING * (RECIPE_NUM_COLUMNS - 1)) / RECIPE_NUM_COLUMNS;
const RECIPE_PAGE_WIDTH = screenWidth; // Each page is full width

// Define a height for the category section content area
const CATEGORY_SECTION_HEIGHT = 300; // Example height, adjust as needed
// Define a height for the recipe section content area
const RECIPE_SECTION_HEIGHT = 250; // Example height for recipes, adjust as needed

// Define the composite navigation prop type
type HomeScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<DrawerParamList, 'Home'>, // Specify 'Home' as the current screen in the drawer
  StackNavigationProp<RootStackParamList> // Include stack navigation capabilities
>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const { showActionSheetWithOptions } = useActionSheet();
  
  // Quick DB check for debugging
  React.useEffect(() => {
    const checkIngredientsTable = async () => {
      // Check if there are any ingredients in the recipe_ingredients table
      const { data, error, count } = await supabase
        .from('recipe_ingredients')
        .select('*', { count: 'exact' });
      
      console.log('Recipe ingredients check - count:', count);
      console.log('Recipe ingredients check - error:', error);
      if (data && data.length > 0) {
        console.log('Recipe ingredients check - first item:', JSON.stringify(data[0]));
      } else {
        console.log('Recipe ingredients check - no data found');
      }
    };
    
    checkIngredientsTable();
  }, []);
  
  // Use dynamic data loading hooks
  const { menuSections, loading: loadingCategories, error: categoriesError, refresh: refreshMenuSections } = useMenuSections();
  const { recipes, loading: loadingRecipes, error: recipesError } = useRecipes();

  const handleCategoryPress = (category: any) => {
    navigation.navigate('CategoryRecipes', {
      categoryId: category.menu_section_id,
      categoryName: category.name,
    });
  };

  const handleRecipePress = (recipe: any) => {
    navigation.navigate('RecipeDetails', { recipeId: recipe.recipe_id });
  };

  const handleAddSection = async (sectionName: string) => {
    try {
      // Insert the new section with ONLY the name field
      // Let PostgreSQL handle ID assignment automatically through its sequence
      const { data, error } = await supabase
        .from('menu_section')
        .insert({ name: sectionName }) // Only specify the name, omit the ID entirely
        .select()
        .single();
      
      if (error) throw error;
      
      Alert.alert(
        "Success",
        `Section "${sectionName}" has been added successfully.`,
        [{ text: "OK" }]
      );
      
      // Refresh menu sections
      refreshMenuSections();
    } catch (error: any) {
      console.error('Error adding section:', error);
      Alert.alert(
        "Error",
        `Failed to add section "${sectionName}". Please try again. Error: ${error.message || String(error)}`,
        [{ text: "OK" }]
      );
    }
  };

  // --- Category Paging Logic ---
  const formattedCategories = menuSections?.map(section => ({...section /* icon: 'silverware-fork-knife' */})) || [];
  const categoriesWithAdd = [...formattedCategories, { isAddCard: true }];
  const categoryPages = chunk(categoriesWithAdd, CATEGORIES_PER_PAGE);
  const totalCategoryPages = categoryPages.length;
  const [currentCategoryPage, setCurrentCategoryPage] = useState(0);
  const categoryFlatListRef = useRef<FlatList | null>(null);
  const onCategoryViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentCategoryPage(viewableItems[0].index);
    }
  }, []);
  const categoryViewabilityConfig = { itemVisiblePercentThreshold: 50 };
  const renderCategoryPage = ({ item: pageItems, index: pageIndex }: { item: any[], index: number }) => {
    return (
      <View style={[styles.pageContainer, { width: CAT_PAGE_WIDTH }]}>
        {pageItems.map((item, itemIndex) => {
          const isLastInRow = (itemIndex + 1) % CATEGORY_NUM_COLUMNS === 0;
          return (
            <View 
              key={item.isAddCard ? `add-${pageIndex}-${itemIndex}` : item.menu_section_id} 
              style={[
                styles.categoryItemContainer,
                { width: categoryItemWidth }, 
                isLastInRow ? { marginRight: 0 } : { marginRight: CAT_ITEM_SPACING } 
              ]}
            >
              {item.isAddCard ? (
                <AddCategoryCard onAdd={handleAddSection} />
              ) : (
                <CategoryCard
                  category={item}
                  onPress={() => handleCategoryPress(item)}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  // --- Recipe Paging Logic ---
  const recentRecipes = recipes
    ? [...recipes]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        // Remove slice, paging handles display
    : [];
  const recipePages = chunk(recentRecipes, RECIPES_PER_PAGE);
  const totalRecipePages = recipePages.length;
  const [currentRecipePage, setCurrentRecipePage] = useState(0);
  const recipeFlatListRef = useRef<FlatList | null>(null);
  const onRecipeViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentRecipePage(viewableItems[0].index);
    }
  }, []);
  const recipeViewabilityConfig = { itemVisiblePercentThreshold: 50 };

  // Render a single recipe page (2x4 grid)
  const renderRecipePage = ({ item: pageItems, index: pageIndex }: { item: Recipe[], index: number }) => {
    return (
      <View style={[styles.recipePageContainer, { width: RECIPE_PAGE_WIDTH }]}>
        {pageItems.map((recipe, itemIndex) => {
          const isLastInRow = (itemIndex + 1) % RECIPE_NUM_COLUMNS === 0;
          return (
            <View 
              key={recipe.recipe_id} 
              style={[
                styles.recipeItemContainer,
                { width: recipeItemWidth }, // Use calculated width
                isLastInRow ? { marginRight: 0 } : { marginRight: RECIPE_ITEM_SPACING } // Dynamic margin
              ]}
            >
              <RecipeGridItem
                recipe={{
                  // Map recipe data
                  recipe_id: recipe.recipe_id.toString(),
                  recipe_name: recipe.recipe_name,
                  menu_section_id: recipe.menu_section_id.toString(),
                  directions: recipe.directions || '',
                  prep_time: recipe.prep_time,
                  total_time: recipe.total_time,
                  rest_time: recipe.rest_time,
                  servings: recipe.servings,
                  cooking_notes: recipe.cooking_notes || '',
                }}
                onPress={() => handleRecipePress(recipe)}
              />
            </View>
          );
        })}
      </View>
    );
  };

  // --- Action Sheet Logic for Upload ---
  const handleUploadRecipePress = async () => {
    const options = ['Upload File', 'Choose from Library', 'Take Photo', 'Cancel'];
    const cancelButtonIndex = 3;
    const destructiveButtonIndex = -1; // No destructive action

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
        title: 'Upload Recipe',
        message: 'Choose an upload method',
        // You can customize colors here if needed using containerStyle, textStyle, etc.
      },
      async (selectedIndex?: number) => {
        if (selectedIndex === undefined) return; // Handle case where nothing is selected

        switch (selectedIndex) {
          case 0: // Upload File
            console.log('Upload File selected');
            try {
              const result = await DocumentPicker.getDocumentAsync({
                // type: '*/*', // Allow all file types or specify (e.g., 'application/pdf', 'text/plain')
                copyToCacheDirectory: false, // Saves memory if you only need the URI
              });
              console.log('Document Picker Result:', JSON.stringify(result));
              if (!result.canceled && result.assets && result.assets.length > 0) {
                const fileUri = result.assets[0].uri;
                const fileName = result.assets[0].name;
                // TODO: Implement actual file upload logic here with fileUri and fileName
                Alert.alert('File Selected', `Selected: ${fileName}`);
              } else {
                console.log('Document picking cancelled or failed');
              }
            } catch (error) {
              console.error('Error picking document:', error);
              Alert.alert('Error', 'Could not pick document.');
            }
            break;

          case 1: // Choose from Library
            console.log('Choose from Library selected');
            try {
              const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Allow access to your photos to choose an image.');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 1,
              });
              console.log('Image Library Result:', JSON.stringify(result));
              if (!result.canceled && result.assets && result.assets.length > 0) {
                const imageUri = result.assets[0].uri;
                // TODO: Implement actual image upload logic here with imageUri
                Alert.alert('Image Selected', 'Ready to upload from library.');
              } else {
                console.log('Image picking cancelled or failed');
              }
            } catch (error) {
              console.error('Error picking image from library:', error);
              Alert.alert('Error', 'Could not select image from library.');
            }
            break;

          case 2: // Take Photo
            console.log('Take Photo selected');
            try {
              const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
              if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Allow access to your camera to take a photo.');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 1,
              });
              console.log('Camera Result:', JSON.stringify(result));
              if (!result.canceled && result.assets && result.assets.length > 0) {
                const imageUri = result.assets[0].uri;
                // TODO: Implement actual image upload logic here with imageUri
                Alert.alert('Photo Taken', 'Ready to upload captured photo.');
              } else {
                console.log('Camera capture cancelled or failed');
              }
            } catch (error) {
              console.error('Error taking photo:', error);
              Alert.alert('Error', 'Could not take photo.');
            }
            break;

          case cancelButtonIndex:
            console.log('Upload cancelled');
            break;
        }
      }
    );
  };
  // --- End Action Sheet Logic ---

  // Function to open the drawer
  const openDrawerMenu = () => {
    navigation.openDrawer();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader 
        title="Home"
        showMenuButton={true}
        onMenuPress={openDrawerMenu}
      />

      {/* This View wraps Categories and Recipes */}
      <View style={styles.contentArea}>
        {/* --- Categories Section --- */}
        <View style={styles.categoriesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
          </View>
          
          {loadingCategories ? (
            <View style={styles.loadingContainer} />
          ) : categoriesError ? (
            <Text style={styles.errorText}>Error loading categories</Text>
          ) : (
            <View style={styles.sectionContentContainer}> 
              <FlatList
                ref={categoryFlatListRef}
                data={categoryPages} 
                renderItem={renderCategoryPage}
                keyExtractor={(item, index) => `catPage-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onCategoryViewableItemsChanged} 
                viewabilityConfig={categoryViewabilityConfig}
                style={styles.flatListStyle} 
                contentContainerStyle={styles.flatListContentContainer} 
              />
              {/* Category Pagination Dots */} 
              {totalCategoryPages > 1 && (
                <View style={styles.paginationContainer}>
                  {Array.from({ length: totalCategoryPages }).map((_, index) => (
                    <View
                      key={`catDot-${index}`}
                      style={[
                        styles.paginationDot,
                        currentCategoryPage === index ? styles.paginationDotActive : null,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* --- Recent Recipes Section --- */}
        <View style={styles.recentRecipesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Recipes</Text>
            {/* Keep View All Button */}
            <TouchableOpacity onPress={() => console.log('View all recipes')}> 
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity> 
          </View>
          
          {loadingRecipes ? (
            <View style={styles.loadingContainer} />
           ) : recipesError ? (
             <Text style={styles.errorText}>Error loading recipes</Text>
           ) : recentRecipes.length === 0 ? (
             <Text style={styles.noDataText}>No recipes found</Text>
           ) : (
            // Recipe FlatList with Paging
            <View style={styles.recipeFlatListContainer}>
              <FlatList
                ref={recipeFlatListRef}
                data={recipePages}
                renderItem={renderRecipePage}
                keyExtractor={(item, index) => `recipePage-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onRecipeViewableItemsChanged}
                viewabilityConfig={recipeViewabilityConfig}
                style={styles.flatListStyle} // Use same style as category list
                contentContainerStyle={styles.flatListContentContainer}
              />
              {/* Recipe Pagination Dots */} 
              {totalRecipePages > 1 && (
                <View style={styles.paginationContainer}>
                  {Array.from({ length: totalRecipePages }).map((_, index) => (
                    <View
                      key={`recipeDot-${index}`}
                      style={[
                        styles.paginationDot,
                        currentRecipePage === index ? styles.paginationDotActive : null,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </View> 
      {/* End contentArea View */} 

      {/* This View wraps the fixed buttons */}
      <View style={styles.fixedFabContainer}>
        <TouchableOpacity 
          style={[styles.floatingButton, styles.createButton]}
          onPress={() => navigation.navigate('CreateRecipe')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="plus" size={20} color={COLORS.white} />
          <Text style={styles.floatingButtonText}>Create Recipe</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.floatingButton, styles.uploadButton]}
          onPress={handleUploadRecipePress}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="upload" size={20} color={COLORS.white} />
          <Text style={styles.floatingButtonText}>Upload Recipe</Text>
        </TouchableOpacity>
      </View>
      {/* End fixedFabContainer View */} 

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentArea: {
    flex: 1, 
    flexDirection: 'column', // Ensure vertical layout
  },
  categoriesSection: {
    paddingVertical: SIZES.padding / 2, 
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.padding / 2, // Reduce margin
    paddingHorizontal: RECIPE_PADDING, 
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  recipesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: RECIPE_PADDING,
    alignItems: 'flex-start', 
    alignContent: 'flex-start', 
  },
  recentRecipesSection: {
    paddingVertical: SIZES.padding / 2, 
    flex: 1, 
  },
  viewAllText: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  fixedFabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding, 
    paddingBottom: SIZES.padding * 2, 
    backgroundColor: COLORS.background, 
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding * 0.75,
    paddingHorizontal: SIZES.padding * 1.5,
    borderRadius: 25, // Pill shape
    margin: 8,
    ...SHADOWS.medium,
  },
  createButton: {
    backgroundColor: COLORS.tertiary,
  },
  uploadButton: {
    backgroundColor: COLORS.primary,
  },
  floatingButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: { // Re-add loading container style
    height: 150, // Adjust height as needed
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: { // Re-add error text style
    color: COLORS.error,
    textAlign: 'center',
    marginVertical: SIZES.padding,
    paddingHorizontal: RECIPE_PADDING, // Add padding to align with grid
  },
  noDataText: { // Re-add no data text style
     color: COLORS.textLight,
     textAlign: 'center',
     marginVertical: SIZES.padding,
     paddingHorizontal: RECIPE_PADDING, // Add padding to align with grid
  },
  flatListStyle: {
    // No horizontal padding, FlatList spans screen width for paging
  },
  flatListContentContainer: {
    // No padding needed here
  },
  // --- Category Styles --- 
  pageContainer: { // Renamed from pageContainer to avoid conflict if styles differ
    width: CAT_PAGE_WIDTH, 
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    paddingHorizontal: CAT_PADDING,
  },
  categoryItemContainer: {
    marginBottom: CAT_ITEM_SPACING,
    // width and marginRight applied dynamically
  },
  // --- Pagination Styles (Shared) --- 
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SIZES.padding, 
    paddingBottom: SIZES.padding, 
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textLight,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: COLORS.primary,
  },
  recipePageContainer: { // Style for each page in the recipe FlatList
    width: RECIPE_PAGE_WIDTH, // Set dynamically
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: RECIPE_PADDING,
    alignItems: 'flex-start', 
  },
  recipeItemContainer: {
    // width and marginRight applied dynamically
    marginBottom: RECIPE_ITEM_SPACING, 
  },
  sectionContentContainer: { // Style for category FlatList container
    height: CATEGORY_SECTION_HEIGHT,
    // Add other styles if needed, e.g., backgroundColor for debugging
    // backgroundColor: 'rgba(0, 255, 0, 0.1)', // Example background
  },
  recipeFlatListContainer: { // Style for recipe FlatList container
    height: RECIPE_SECTION_HEIGHT,
    // Add other styles if needed
    // backgroundColor: 'rgba(0, 0, 255, 0.1)', // Example background
  },
});

export default HomeScreen;