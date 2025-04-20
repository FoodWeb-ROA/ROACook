import React, { useState, useRef, useCallback, useMemo } from 'react';
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
  ScrollView,
  RefreshControl,
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
import { Category, Dish } from '../types';
import CategoryCard from '../components/CategoryCard';
import AddCategoryCard from '../components/AddCategoryCard';
import DishGridItem from '../components/DishGridItem';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { useMenuSections, useDishes } from '../hooks/useSupabase';
import { supabase } from '../data/supabaseClient';
import { uploadRecipeImages } from '../services/recipeParser';
import { useTranslation } from 'react-i18next';

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
// Make category padding match recipe padding for consistency
const CAT_PADDING = SIZES.padding;
const CAT_ITEM_SPACING = SIZES.padding*0.8;
const catAvailableWidthInPage = screenWidth - CAT_PADDING * 2;
const categoryItemWidth = (catAvailableWidthInPage - CAT_ITEM_SPACING * (CATEGORY_NUM_COLUMNS - 1)) / CATEGORY_NUM_COLUMNS;
const CAT_PAGE_WIDTH = screenWidth;

// --- Recipe Grid Constants for 4 rows --- 
const RECIPE_NUM_COLUMNS = 2;
const RECIPE_NUM_ROWS = 4; // Changed from 3 to 4
const RECIPES_PER_PAGE = RECIPE_NUM_ROWS * RECIPE_NUM_COLUMNS; // 2 columns * 4 rows
const RECIPE_PADDING = SIZES.padding;
// Reduce spacing between recipe items
const RECIPE_ITEM_SPACING = SIZES.padding;

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

// Define height calculations for fixed screen layout
const HEADER_HEIGHT = 60; // Approximate height of AppHeader
const SECTION_HEADER_HEIGHT = 40; // Approximate height of section headers
const PAGINATION_HEIGHT = 30; // Approximate height of pagination dots
const FAB_CONTAINER_HEIGHT = 70; // Approximate height of the floating action button container

// Calculate available space for content sections
// ... existing code ...

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const { showActionSheetWithOptions } = useActionSheet();
  const { t } = useTranslation();
  
  // Use dynamic data loading hooks
  const { menuSections, loading: loadingCategories, error: categoriesError, refresh: refreshMenuSections } = useMenuSections();
  const { dishes, loading: loadingDishes, error: dishesError } = useDishes();

  const [isParsing, setIsParsing] = useState(false);

  const handleCategoryPress = (category: Category) => {
    navigation.navigate('CategoryRecipes', {
      categoryId: category.menu_section_id,
      categoryName: category.name,
    });
  };

  const handleDishPress = (dish: Dish) => {
    navigation.navigate('DishDetails', { dishId: dish.dish_id });
  };

  const handleAddSection = async (sectionName: string) => {
    try {
      // TODO: Replace placeholder with actual logic to get kitchen_id
      const placeholderKitchenId = process.env.EXPO_PUBLIC_DEFAULT_KITCHEN_ID; 
      console.log('>>> Read Kitchen ID from env:', placeholderKitchenId); // Add diagnostic log
      if (placeholderKitchenId === process.env.EXPO_PUBLIC_DEFAULT_KITCHEN_ID) {
          console.warn('Using placeholder kitchen ID in handleAddSection');
          // Optionally Alert the user or prevent adding if no real ID is available
          // Alert.alert("Setup Needed", "Kitchen selection not implemented yet.");
          // return;
      }

      // Ensure kitchen ID is available before proceeding
      if (!placeholderKitchenId) {
        Alert.alert(
          t('common.error'),
          t('screens.home.error.missingKitchenId'),
          [{ text: t('common.ok', 'OK') }]
        );
        console.error('Error adding section: kitchen_id is undefined. Check environment variables or configuration.');
        return; // Stop execution if kitchen ID is missing
      }

      const { data, error } = await supabase
        .from('menu_section')
        // Provide the required kitchen_id
        .insert({ name: sectionName, kitchen_id: placeholderKitchenId }) 
        .select()
        .single();
      
      if (error) throw error;
      
      Alert.alert(
        t('screens.home.addSectionSuccessTitle'),
        t('screens.home.addSectionSuccessMessage', { sectionName }),
        [{ text: t('common.ok', 'OK') }]
      );
      
      refreshMenuSections();
    } catch (error: any) {
      console.error('Error adding section:', error);
      Alert.alert(
        t('common.error'),
        t('screens.home.addSectionError', { sectionName, error: error.message || String(error) }),
        [{ text: t('common.ok', 'OK') }]
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
        {chunk(pageItems, CATEGORY_NUM_COLUMNS).map((rowItems, rowIndex) => (
          <View key={`cat-row-${pageIndex}-${rowIndex}`} style={styles.categoryRow}>
            {rowItems.map((item, colIndex) => {
              const isLastInRow = colIndex === CATEGORY_NUM_COLUMNS - 1;
              return (
                <View 
                  key={item.isAddCard ? `add-${pageIndex}-${colIndex}` : item.menu_section_id} 
                  style={[
                    styles.categoryItemContainer,
                    { 
                      width: categoryItemWidth,
                      marginRight: isLastInRow ? 0 : CAT_ITEM_SPACING
                    }
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
        ))}
      </View>
    );
  };

  // Add ref and state for recipe pagination
  const recipeFlatListRef = useRef<FlatList | null>(null);
  const [currentRecipePage, setCurrentRecipePage] = useState(0);

  // Add viewability change handler for recipes
  const onRecipeViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentRecipePage(viewableItems[0].index);
    }
  }, []);
  const recipeViewabilityConfig = { itemVisiblePercentThreshold: 50 };

  // Filter and sort dishes for the 'Recent Dishes' section
  const recentDishes = useMemo(() => {
    if (!dishes) return [];
    // Example sorting: by creation date if available, otherwise just slice
    // Assuming dishes array might have a created_at or similar field eventually
    // For now, just take the first dishes as they come from the hook
    return dishes.slice(0, 32); // Increased slice to allow for more pages (e.g., 4 pages of 8)
  }, [dishes]);

  // Chunk the dishes into pages
  const recipePages = useMemo(() => {
    return chunk(recentDishes, RECIPES_PER_PAGE);
  }, [recentDishes]);
  
  const totalRecipePages = recipePages.length;

  const isLoading = loadingCategories || loadingDishes;
  const hasError = categoriesError || dishesError;
  
  // Render a page of dishes (horizontal paging)
  const renderRecipePage = ({ item: pageItems, index: pageIndex }: { item: Dish[], index: number }) => {
    return (
      <View style={[styles.recipePage, { width: RECIPE_PAGE_WIDTH }]}>
        {chunk(pageItems, RECIPE_NUM_COLUMNS).map((rowItems, rowIndex) => (
          <View key={`row-${pageIndex}-${rowIndex}`} style={styles.recipeRow}>
            {rowItems.map((dish, colIndex) => {
              const isLastInRow = colIndex === RECIPE_NUM_COLUMNS - 1;
              return (
                <View 
                  key={dish.dish_id} 
                  style={[
                    styles.recipeItemContainer,
                    { 
                      width: recipeItemWidth,
                      marginRight: isLastInRow ? 0 : RECIPE_ITEM_SPACING
                    }
                  ]}
                >
                  <DishGridItem
                    dish={dish}
                    onPress={() => handleDishPress(dish)}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // --- Action Sheet Logic for Upload ---
  const handleUploadRecipePress = async () => {
    showActionSheetWithOptions(
      {
        options: [
          t('screens.home.uploadOptions.document'),
          t('screens.home.uploadOptions.photos'),
          t('common.cancel')
        ],
        cancelButtonIndex: 2,
        title: t('screens.home.uploadOptions.title')
      },
      async (selectedIndex?: number) => {
        if (selectedIndex === 0) {
          // Pick Document
          try {
            const result = await DocumentPicker.getDocumentAsync({
              type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            });

            if (!result.canceled && result.assets && result.assets[0]) {
              const asset = result.assets[0];
              setIsParsing(true);
              // TODO: Implement actual parsing logic here
              console.log('Selected Document:', asset.uri);
              // Replace with call to your backend/parsing service
              await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate parsing time
              setIsParsing(false);
              Alert.alert(t('screens.home.parsingSuccessTitle'), t('screens.home.parsingSuccessMessageDocument'));
              // TODO: Navigate to recipe creation/edit screen with parsed data
            } else {
              console.log('Document selection cancelled or failed');
            }
          } catch (err) {
            setIsParsing(false);
            console.error('Error picking document:', err);
            Alert.alert(t('common.error'), t('screens.home.error.documentPick'));
          }
        } else if (selectedIndex === 1) {
          // Pick Images
          try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
              Alert.alert(t('screens.home.permissionDeniedTitle'), t('screens.home.permissionDeniedMessage'));
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsMultipleSelection: true, // Allow selecting multiple images
              quality: 1,
            });

            if (!result.canceled && result.assets) {
              setIsParsing(true);
              console.log('Selected Images:', result.assets.map(a => a.uri));
              // TODO: Implement actual parsing logic here, potentially uploading images
              // Example: Use the uploadRecipeImages function if it fits your backend
              // const recipeData = await uploadRecipeImages(result.assets);
              // console.log('Parsed Recipe Data:', recipeData);
              await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate parsing time
              setIsParsing(false);
              Alert.alert(t('screens.home.parsingSuccessTitle'), t('screens.home.parsingSuccessMessagePhotos'));
              // TODO: Navigate to recipe creation/edit screen with parsed data
            } else {
              console.log('Image selection cancelled or failed');
            }
          } catch (err) {
            setIsParsing(false);
            console.error('Error picking images:', err);
            Alert.alert(t('common.error'), t('screens.home.error.imagePick'));
          }
        }
      }
    );
  };

  // Function to open the drawer
  const openDrawerMenu = () => {
    navigation.openDrawer();
  };

  const renderHeaderRight = () => (
    <TouchableOpacity onPress={handleUploadRecipePress} style={styles.uploadButton} disabled={isParsing}>
      {isParsing ? 
        <ActivityIndicator size="small" color={COLORS.primary} /> : 
        <MaterialCommunityIcons name="upload" size={28} color={COLORS.text} />
      }
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <AppHeader 
        title="ROA"
        showMenuButton={true}
        onMenuPress={openDrawerMenu}
        rightComponent={renderHeaderRight()}
      />

      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={loadingCategories || loadingDishes} onRefresh={refreshMenuSections} />
        }
      >
        {/* Category Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('screens.home.categoriesTitle')}</Text>
          </View>
          <View style={{ height: CATEGORY_SECTION_HEIGHT }}>
            {loadingCategories ? (
              <ActivityIndicator color={COLORS.primary} size="large" style={styles.loader} />
            ) : categoriesError ? (
              <Text style={styles.errorText}>{t('screens.home.errorLoadingCategories')}</Text>
            ) : formattedCategories.length === 0 ? (
              <Text style={styles.noDataText}>{t('screens.home.noCategoriesFound')}</Text>
            ) : (
              <>
                <FlatList
                  ref={categoryFlatListRef}
                  data={categoryPages}
                  renderItem={renderCategoryPage}
                  keyExtractor={(_, index) => `category-page-${index}`}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onViewableItemsChanged={onCategoryViewableItemsChanged}
                  viewabilityConfig={categoryViewabilityConfig}
                  style={styles.flatListStyle}
                  contentContainerStyle={styles.flatListContentContainer}
                />
              </>
            )}
          </View>
          
          {/* --- Dots between Categories and Recent Dishes --- */}
          {totalCategoryPages > 1 && (
            <View style={styles.dotSeparatorContainer}> 
              {Array.from({length: totalCategoryPages}).map((_, index) => (
                <View
                  key={`cat-dot-${index}`}
                  style={[
                    styles.paginationDot,
                    currentCategoryPage === index && styles.paginationDotActive
                  ]}
                />
              ))}
            </View>
          )}
        </View>
        
        {/* Recent Dishes Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { fontSize: SIZES.medium }]}>{t('screens.home.recentDishesTitle')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AllRecipes')}>
              <Text style={[styles.viewAllText, { fontSize: SIZES.small }]}>{t('screens.home.viewAll')}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: RECIPE_SECTION_HEIGHT }}>
            {loadingDishes ? (
              <ActivityIndicator color={COLORS.primary} size="large" style={styles.loader} />
            ) : dishesError ? (
              <Text style={[styles.errorText, { fontSize: SIZES.small }]}>{t('screens.home.errorLoadingDishes')}</Text>
            ) : dishes.length === 0 ? (
              <Text style={[styles.noDataText, { fontSize: SIZES.small }]}>{t('screens.home.noDishesFound')}</Text>
            ) : (
              <>
                <FlatList
                  ref={recipeFlatListRef}
                  data={recipePages}
                  renderItem={renderRecipePage}
                  keyExtractor={(_, index) => `recipe-page-${index}`}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onViewableItemsChanged={onRecipeViewableItemsChanged}
                  viewabilityConfig={recipeViewabilityConfig}
                  style={styles.flatListStyle}
                  contentContainerStyle={[styles.flatListContentContainer, { paddingBottom: SIZES.padding * 0.5 }]}
                />
                {totalRecipePages > 1 && (
                  <View style={styles.paginationContainer}> 
                    {Array.from({length: totalRecipePages}).map((_, index) => (
                      <View
                        key={`recipe-dot-${index}`}
                        style={[
                          styles.paginationDot,
                          currentRecipePage === index && styles.paginationDotActive
                        ]}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* FAB */}
      {isParsing && (
        <View style={styles.parsingOverlay}>
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.parsingText}>{t('screens.home.parsingIndicator', 'Parsing Recipe...')} </Text>
        </View>
      )}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={styles.floatingButton}
          onPress={() => navigation.navigate('CreateRecipe', {})}
          disabled={isParsing}
        >
          <MaterialCommunityIcons name="plus" size={28} color={COLORS.white} />
          <Text style={styles.floatingButtonText}>{t('screens.home.addRecipeButton')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingBottom: SIZES.padding, // Add padding at the very bottom
  },
  container: {
    flex: 1,
  },
  contentArea: {
    flexDirection: 'column',
    flex: 1,
    paddingTop: SIZES.padding*0.5, 
  },
  categoriesSection: {
    flex: 0.5, // Adjust flex proportion
    paddingBottom: 0,
    marginBottom: SIZES.padding * 0.8, // Increase space below categories section slightly more
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.padding / 2, // Standard margin below header
    paddingHorizontal: RECIPE_PADDING, // Use consistent padding
    verticalAlign: 'middle',
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  recipesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: RECIPE_PADDING,
  },
  recentDishesSection: {
    flex: 0.5, // Adjust flex proportion
    paddingTop: 0,
    // Removed paddingBottom to reduce space below recipes before dots
    // Removed marginTop: 0 as it's default
  },
  viewAllText: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  fixedFabContainer: {
    paddingHorizontal: SIZES.padding * 2.0,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding * 0.75,
    paddingHorizontal: SIZES.padding,
    borderRadius: 25, // Pill shape
    margin: 8,
    width: '60%',
    ...SHADOWS.medium,
  },
  createButton: {
    backgroundColor: COLORS.tertiary,
  },
  floatingButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: { // Re-add loading container style
    height: 200, // Adjust height as needed
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
    // flex: 1, // REMOVED
  },
  flatListContentContainer: {
    // No padding needed here initially
  },
  // --- Category Styles --- 
  pageContainer: { // Style for category pages
    width: CAT_PAGE_WIDTH,
    paddingHorizontal: CAT_PADDING,
    flex: 1, // Allow page container to fill space
  },
  categoryItemContainer: {
    marginBottom: CAT_ITEM_SPACING, // Consistent spacing
  },
  // --- Pagination Styles (Shared) --- 
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // marginTop: -SIZES.padding * 10, // Negative margin to pull dots up - REMOVED
    // paddingVertical: SIZES.padding * 0.25, // Add small vertical padding to ensure dots aren't cut off
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: COLORS.textLight,
  },
  recipeItemContainer: {
     // Removed marginBottom here, handled by recipeRow
  },
  sectionContentContainer: {
    flex: 1,
    height: undefined, 
  },
  uploadButton: {
    padding: SIZES.base,
  },
  recipeSectionContainer: {
    flex: 1, // Restore flex: 1 to ensure it fills parent space
    height: undefined,
  },
  
  recipePage: { // Style for recipe pages
    paddingHorizontal: RECIPE_PADDING,
    justifyContent: 'flex-start', // Align rows to the top
    width: RECIPE_PAGE_WIDTH,
    flex: 1, // Allow page container to fill space
  },

  bottomContainer: {
    flex: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  
  recipeRow: {
    flexDirection: 'row',
    marginBottom: RECIPE_ITEM_SPACING, // Use standard item spacing
    justifyContent: 'space-between', // Ensure items spread
  },
  
  categoryRow: {
    flexDirection: 'row',
    marginBottom: CAT_ITEM_SPACING, // Use standard item spacing
    justifyContent: 'space-between', // Ensure items spread
  },
  // New style for the dot separator containers
  dotSeparatorContainer: {
    height: 5, // Restore height to create space
    // Removed paddingVertical to center dots in the new margin space
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // Remove paddingVertical if added by user
  },
  sectionContainer: {
    flex: 1,
    padding: SIZES.padding,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  parsingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  parsingText: {
    color: COLORS.white,
    fontSize: SIZES.medium,
    fontWeight: 'bold',
    marginTop: SIZES.padding,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SIZES.padding,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;