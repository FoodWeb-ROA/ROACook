import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
import { Category, Dish, ParsedIngredient } from '../types';
import CategoryCard from '../components/CategoryCard';
import AddCategoryCard from '../components/AddCategoryCard';
import DishGridItem from '../components/DishGridItem';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { useMenuSections, useDishes } from '../hooks/useSupabase';
import { supabase } from '../data/supabaseClient';
import { uploadRecipeImages } from '../services/recipeParser';
import { processParsedRecipe } from '../utils/recipeProcessor';
import { useTranslation } from 'react-i18next';
import { useTypedSelector } from '../hooks/useTypedSelector';
import { queryClient } from '../data/queryClient';
import UpdateNotificationBanner from '../components/UpdateNotificationBanner';
import { useUnits } from '../hooks/useSupabase';
import { useLookup } from '../hooks/useLookup';
import { findCloseIngredient, checkPreparationNameExists } from '../data/dbLookup';
import { appLogger } from '../services/AppLogService';

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
const RECIPE_PADDING = SIZES.padding;
const CAT_PADDING = RECIPE_PADDING; // Use RECIPE_PADDING for categories as well
const CAT_ITEM_SPACING = SIZES.padding / 2;
// Recalculate available width based on RECIPE_PADDING (from sectionContainer)
const catAvailableWidthInPage = (screenWidth - RECIPE_PADDING * 2);
const categoryItemWidth = (catAvailableWidthInPage - CAT_ITEM_SPACING * (CATEGORY_NUM_COLUMNS - 1)) / CATEGORY_NUM_COLUMNS;
const CAT_PAGE_WIDTH = screenWidth;

// --- Recipe Grid Constants for 4 rows --- 
const RECIPE_NUM_COLUMNS = 2;
const RECIPE_NUM_ROWS = 4; // Changed from 3 to 4
const RECIPES_PER_PAGE = RECIPE_NUM_ROWS * RECIPE_NUM_COLUMNS; // 2 columns * 4 rows
// Reduce spacing between recipe items
const RECIPE_ITEM_SPACING = SIZES.padding;

// Recalculate width available inside recipe page padding
const recipeAvailableWidthInPage = screenWidth - RECIPE_PADDING * 2;
// Recalculate width for each recipe item (2 columns)
const recipeItemWidth = (recipeAvailableWidthInPage - RECIPE_ITEM_SPACING * (RECIPE_NUM_COLUMNS - 1)) / RECIPE_NUM_COLUMNS;
const RECIPE_PAGE_WIDTH = screenWidth; // Each page is full width

// Calculate the width of the visible content area within the padding
const VISIBLE_CONTENT_WIDTH = screenWidth - RECIPE_PADDING * 2;

// Define a height for the category section content area
const CATEGORY_SECTION_HEIGHT = 300; // Example height, adjust as needed
// Define a height for the recipe section content area
const RECIPE_SECTION_HEIGHT = 250; // Example height for recipes, adjust as needed

// Define a height for the central separating container
const CENTRAL_SEPARATOR_HEIGHT = SIZES.padding/4;

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

// Add extra bottom padding so content is not hidden behind FAB
const SCROLL_EXTRA_PADDING = FAB_CONTAINER_HEIGHT + SIZES.padding/4;

// Calculate available space for content sections
// ... existing code ...

const HomeScreen = () => {
  console.log("--- App code loaded successfully ---");
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const { showActionSheetWithOptions } = useActionSheet();
  const { t } = useTranslation();
  
  // Get the active kitchen ID from Redux state
  const activeKitchenId = useTypedSelector(state => state.kitchens.activeKitchenId);
  
  // Get hooks data, including lastUpdateTime
  const { menuSections, isLoading: loadingCategories, error: categoriesError, lastUpdateTime: categoriesLastUpdate } = useMenuSections();
  const { dishes, loading: loadingDishes, error: dishesError, lastUpdateTime: dishesLastUpdate } = useDishes();
  const { units, loading: loadingUnits } = useUnits();
  const lookupFunctions = useLookup();

  const [isParsing, setIsParsing] = useState(false);

  // State and Ref for Banner
  const [showBanner, setShowBanner] = useState(false);
  const lastUpdateTimeRef = useRef<number | null>(null); // Use a single ref

  // Effect to show banner on update from either hook
  useEffect(() => {
    const latestUpdate = Math.max(categoriesLastUpdate || 0, dishesLastUpdate || 0);
    // Check if latestUpdate is valid and different from the stored ref
    if (latestUpdate > 0 && latestUpdate !== lastUpdateTimeRef.current) {
      setShowBanner(true);
      lastUpdateTimeRef.current = latestUpdate; // Update ref to the latest timestamp
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 3000); // Hide banner after 3 seconds
      return () => clearTimeout(timer); // Cleanup timer
    }
    // If timestamps become null (e.g., hook reset), don't show banner unless they become valid again
  }, [categoriesLastUpdate, dishesLastUpdate]);

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
      // Get kitchen_id from Redux state
      const kitchenId = activeKitchenId;
      appLogger.log('>>> Using active kitchen ID:', kitchenId);

      // Ensure kitchen ID is available before proceeding
      if (!kitchenId) {
        Alert.alert(
          t('common.error'),
          t('screens.home.error.missingKitchenId'),
          [{ text: t('common.ok', 'OK') }]
        );
        appLogger.error('Error adding section: No active kitchen selected. Please select a kitchen first.');
        return; // Stop execution if kitchen ID is missing
      }

      const { data, error } = await supabase
        .from('menu_section')
        .insert({ name: sectionName, kitchen_id: kitchenId })
        .select()
        .single();
      
      if (error) throw error;
      
      // Instead of manual refresh, invalidate the query cache
      appLogger.log(`[HomeScreen] Invalidating menu section query for kitchen: ${kitchenId}`);
      queryClient.invalidateQueries({ queryKey: ['menu_section', { kitchen_id: kitchenId }] });

      // Success alert removed
    } catch (error: any) {
      appLogger.error('Error adding section:', error);
      Alert.alert(
        t('common.error'),
        t('screens.home.addSectionError', { sectionName, error: error.message || String(error) }),
        [{ text: t('common.ok', 'OK') }]
      );
    }
  };

  // --- Category Paging Logic ---
  const formattedCategories = useMemo(() => {
    // Use isLoading from useQuery instead of local loading state
    return menuSections?.map(section => ({...section})) || [];
  }, [menuSections, t, isParsing]);
  
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

  const handleDeleteCategory = async (categoryId: string) => {
    if (!activeKitchenId) {
      Alert.alert(
        t('common.error'),
        t('screens.home.error.missingKitchenId'),
        [{ text: t('common.ok', 'OK') }]
      );
      console.error('Error deleting section: No active kitchen selected.');
      return;
    }

    try {
      const { error } = await supabase
        .from('menu_section')
        .delete()
        .eq('menu_section_id', categoryId)
        .eq('kitchen_id', activeKitchenId);

      if (error) throw error;

      console.log(`[HomeScreen] Invalidating menu section query for kitchen: ${activeKitchenId}`);
      queryClient.invalidateQueries({ queryKey: ['menu_section', { kitchen_id: activeKitchenId }] });

    } catch (error: any) {
      console.error('Error deleting section:', error);
      Alert.alert(
        t('common.error'),
        t('screens.home.deleteSectionError', { categoryName: menuSections?.find(ms => ms.menu_section_id === categoryId)?.name || t('common.category'), error: error.message || String(error) }),
        [{ text: t('common.ok', 'OK') }]
      );
    }
  };

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
                      onDelete={handleDeleteCategory} 
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
                    onDelete={handleDeleteDish}
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
    const options = ['Choose from Library', 'Take Photo', 'Upload File', 'Cancel'];
    const cancelButtonIndex = 3;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        title: 'Import Recipe',
        message: 'Select images or a file containing the recipe',
      },
      async (selectedIndex?: number) => {
        if (selectedIndex === undefined || selectedIndex === cancelButtonIndex) return;

        let imageUris: string[] = [];

        try {
            if (selectedIndex === 0) {
                let result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: "images",
                    quality: 0.8,
                });

                if (!result.canceled && result.assets) {
                    imageUris = result.assets.map(asset => asset.uri);
                }
            } else if (selectedIndex === 1) {
                const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
                if (permissionResult.granted === false) {
                    Alert.alert("Permission Required", "Camera access is needed to take a photo.");
                    return;
                }

                let result = await ImagePicker.launchCameraAsync({
                    quality: 0.8,
                });

                if (!result.canceled && result.assets) {
                    imageUris = [result.assets[0].uri];
                }
            } else if (selectedIndex === 2) {
                appLogger.log('Upload File selected');
                 try {
                    const result = await DocumentPicker.getDocumentAsync({
                        copyToCacheDirectory: false, 
                    });
                    appLogger.log('Document Picker Result:', JSON.stringify(result));
                    if (!result.canceled && result.assets && result.assets.length > 0) {
                        const asset = result.assets[0];
                        if (asset.mimeType?.startsWith('image/')) {
                            imageUris = [asset.uri];
                        } else {
                           Alert.alert('File Type Note', `Selected: ${asset.name}. Parsing non-image files via this method is not fully supported yet.`);
                        }
                    } else {
                        appLogger.log('Document picking cancelled or failed');
                    }
                } catch (error) {
                    appLogger.error('Error picking document:', error);
                    Alert.alert('Error', 'Could not pick document.');
                }
            }

            if (imageUris.length > 0) {
                setIsParsing(true);
                try {
                    const parsedRecipes = await uploadRecipeImages(imageUris);
                    appLogger.log('Raw Parsed Recipes:', parsedRecipes);
                    if (parsedRecipes && parsedRecipes.length > 0) {
                        // --- MODIFIED: Process the recipe before navigation, ensuring units are loaded ---
                        if (!loadingUnits && units) { // Check if units are loaded
                            appLogger.log("Units loaded. Starting pre-processing of parsed recipe...");
                            const initialComponents = await processParsedRecipe(
                                parsedRecipes[0],
                                units, 
                                findCloseIngredient, 
                                checkPreparationNameExists,
                                t // Pass translation function
                            );
                            appLogger.log("Finished pre-processing. Navigating...");
                            // Navigate to CreateRecipeScreen with the first parsed recipe AND pre-processed components
                            navigation.navigate('CreateRecipe', { 
                                parsedRecipe: parsedRecipes[0],
                                initialComponents: initialComponents // <-- PASS PROCESSED COMPONENTS
                            });
                        } else {
                            appLogger.warn("Units not loaded yet. Cannot process parsed recipe immediately.");
                            // Handle this case - e.g., show alert, different loading state, or retry later
                            Alert.alert("Processing Delay", "Recipe data is being prepared, please wait a moment."); 
                        }
                        // --- END MODIFIED ---
                    } else {
                        Alert.alert('Parsing Failed', 'Could not extract recipes from the provided image(s).');
                    }
                } catch (processError: any) { // Catch errors from either parsing or processing
                    appLogger.error('Error parsing recipe images or processing recipe:', processError);
                    Alert.alert('Processing Error', processError.message || 'An error occurred during processing.');
                }
                finally {
                    setIsParsing(false);
                }
            } else if (selectedIndex !== 2) {
               appLogger.log('No images selected or camera cancelled.');
            }

        } catch (error) {
            appLogger.error('Error during recipe import process:', error);
            Alert.alert('Error', 'An unexpected error occurred.');
            setIsParsing(false);
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

  // --- FAB Action Sheet Logic ---
  const handleAddButtonPress = () => {
    // Use translation keys for options and title
    const options = [
      t('screens.home.createDishOption', 'Dish'), 
      t('screens.home.createPreparationOption', 'Preparation'), 
      t('common.cancel', 'Cancel')
    ];
    const cancelButtonIndex = 2;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        title: t('screens.home.createActionSheetTitle', 'Create New Recipe'),
        // message: 'Choose what you want to create', // Optional message
      },
      (selectedIndex?: number) => {
        if (selectedIndex === undefined || selectedIndex === cancelButtonIndex) return;

        if (selectedIndex === 0) { // Dish selected
          appLogger.log("Navigating to CreateRecipeScreen (Dish)");
          navigation.navigate('CreateRecipe', {});
        } else if (selectedIndex === 1) { // Preparation selected
          appLogger.log("Navigating to CreatePreparationScreen (Preparation)");
          navigation.navigate('CreatePreparation', {
             // Use translation key for the default preparation name
             preparation: { name: t('screens.home.newPreparationName', 'New Preparation') } as ParsedIngredient,
             onNewPreparationCreated: (newPrepData) => {
                appLogger.log('New preparation created from HomeScreen FAB:', newPrepData);
                queryClient.invalidateQueries({ queryKey: ['ingredients', { include_preparations: true }] });
             },
          });
        }
      }
    );
  };
  // --- End FAB Action Sheet Logic ---

  const handleDeleteDish = async (dishId: string) => {
    if (!activeKitchenId) {
      Alert.alert(
        t('common.error'),
        t('screens.home.error.missingKitchenId'),
        [{ text: t('common.ok', 'OK') }]
      );
      console.error('Error deleting dish: No active kitchen selected.');
      return;
    }

    try {
      const { error } = await supabase
        .from('dishes')
        .delete()
        .eq('dish_id', dishId)
        .eq('kitchen_id', activeKitchenId);

      if (error) throw error;

      console.log(`[HomeScreen] Invalidating dish queries for kitchen: ${activeKitchenId}, dish: ${dishId}`);
      queryClient.invalidateQueries({ queryKey: ['dishes', { kitchen_id: activeKitchenId }] });

    } catch (error: any) {
      console.error('Error deleting dish:', error);
      Alert.alert(
        t('common.error'),
        t('screens.home.deleteDishError', { dishName: dishes?.find(d => d.dish_id === dishId)?.dish_name || t('common.dish'), error: error.message || String(error) }),
        [{ text: t('common.ok', 'OK') }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <UpdateNotificationBanner visible={showBanner} message="Content Updated" />
      <AppHeader 
        title="ROACook"
        showMenuButton={true}
        onMenuPress={openDrawerMenu}
        rightComponent={renderHeaderRight()}
      />

      <ScrollView 
        style={styles.container}
        contentContainerStyle={{ paddingBottom: SCROLL_EXTRA_PADDING }}
        refreshControl={
          <RefreshControl refreshing={loadingCategories || loadingDishes} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['menu_section', { kitchen_id: activeKitchenId }] })} />
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
            ) : (
              <>
                <FlatList
                  ref={categoryFlatListRef}
                  data={categoryPages}
                  renderItem={renderCategoryPage}
                  keyExtractor={(_, index) => `category-page-${index}`}
                  horizontal
                  pagingEnabled={true}
                  disableIntervalMomentum={true}
                  decelerationRate="fast"
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
          <View>
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
                  pagingEnabled={true}
                  disableIntervalMomentum={true}
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
          onPress={handleAddButtonPress}
          disabled={isParsing}
        >
          <MaterialCommunityIcons name="plus" size={28} color={COLORS.white} />
          <Text style={styles.floatingButtonText}>{t('screens.home.addRecipeButton', 'Add Recipe')}</Text>
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
    paddingBottom: SIZES.padding*100
  },
  contentArea: {
    flexDirection: 'column',
    flex: 1,
    paddingTop: SIZES.padding*0.5, 
  },
  categoriesSection: {
    flex: 1, // Adjust flex proportion
    paddingBottom: 0,
    marginBottom: SIZES.padding , // Increase space below categories section slightly more
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
    paddingHorizontal: SIZES.padding,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding / 4,
    paddingHorizontal: SIZES.padding/4,
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
    paddingHorizontal: RECIPE_PADDING, // Add padding back to page
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
    // height: undefined, // No fixed height needed if parent is ScrollView
  },
  
  recipePage: { // Style for recipe pages
    paddingHorizontal: RECIPE_PADDING, // Add padding back to page
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
    // justifyContent: 'space-between', // REMOVED - Rely on item width and margins
  },
  
  categoryRow: {
    flexDirection: 'row',
    marginBottom: CAT_ITEM_SPACING, // Use standard item spacing
    // justifyContent: 'flex-start', // Keep default (flex-start)
  },
  // New style for the dot separator containers
  dotSeparatorContainer: {
    height: CENTRAL_SEPARATOR_HEIGHT, // Use the constant for height
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionContainer: {
    flex: 1,
    marginBottom: SIZES.padding, // Reduced to make spacing equidistant
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
    paddingBottom: SIZES.padding,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;