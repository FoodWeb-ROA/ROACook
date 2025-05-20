import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, StyleSheet
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { appLogger } from '../services/AppLogService';

// Define a more specific type for search results
export interface SearchResultItem {
  ingredient_id: string; // Can be ingredient or preparation ID
  name: string;
  isPreparation?: boolean;
  // Add other relevant fields if needed from lookup results
}

interface ComponentSearchModalProps {
  visible: boolean;
  onClose: () => void;
  searchMode: 'ingredient' | 'preparation';
  // Replace generic search function with specific lookup prop
  performSearch: (query: string) => Promise<SearchResultItem[]>; 
  onSelectItem: (item: SearchResultItem) => void;
  onCreateNew: (name: string, isPreparation: boolean) => void; // Pass isPreparation flag
}

const ComponentSearchModal: React.FC<ComponentSearchModalProps> = ({
  visible,
  onClose,
  searchMode,
  performSearch,
  onSelectItem,
  onCreateNew,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Debounced search effect
  useEffect(() => {
    if (!visible) {
      // Reset state when modal is closed
      setSearchQuery('');
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const handler = setTimeout(() => {
      if (searchQuery.trim()) {
        setSearchLoading(true);
        performSearch(searchQuery.trim())
          .then(results => setSearchResults(results))
          .catch(error => {
            appLogger.error(`Error performing search (${searchMode}):`, error);
            setSearchResults([]);
          })
          .finally(() => setSearchLoading(false));
      } else {
        setSearchResults([]); // Clear results if query is empty
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [searchQuery, performSearch, visible, searchMode]);

  const handleCreateNew = () => {
    if (searchQuery.trim()) {
      onCreateNew(searchQuery.trim(), searchMode === 'preparation');
      // Don't automatically close here, let the parent decide
    }
  };

  const filteredSearchResults = searchResults.filter(item => {
    if (searchMode === 'ingredient') {
      return item.isPreparation === false;
    } else if (searchMode === 'preparation') {
      return item.isPreparation === true;
    }
    return true;
  });

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {searchMode === 'ingredient'
              ? t('screens.createRecipe.selectIngredientModalTitle')
              : t('screens.createRecipe.selectPreparationModalTitle')}
          </Text>
          <TextInput
            style={styles.searchInput}
            placeholder={
              searchMode === 'ingredient'
                ? t('screens.createRecipe.searchPlaceholderIngredients')
                : t('screens.createRecipe.searchPlaceholderPreparations')
            }
            placeholderTextColor={COLORS.placeholder} // Added placeholder color
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus // Focus input when modal opens
          />

          {searchLoading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={styles.searchLoader} />
          ) : (
            <FlatList
              // data={searchResults}
              data={filteredSearchResults}
              keyExtractor={(item) => item.ingredient_id || `search-result-${item.name}-${Math.random()}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => onSelectItem(item)}
                >
                  <Text style={styles.modalItemText}>
                    {item.name} {item.isPreparation ? `(${t('screens.createRecipe.prepSuffixShort')})` : ''}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                searchQuery.trim() !== '' && !searchLoading ? (
                  <View style={styles.emptyListContainer}> 
                    <Text style={styles.emptyListText}>
                      {searchMode === 'ingredient'
                        ? t('screens.createRecipe.searchNoIngredientsFound', { query: searchQuery.trim() })
                        : t('screens.createRecipe.searchNoPreparationsFound', { query: searchQuery.trim() })
                      }
                    </Text>
                    {/* Create button is now outside the list */}
                  </View>
                ) : (
                   <View style={styles.emptyListContainer}> 
                     <Text style={styles.emptyListText}>
                      {searchMode === 'ingredient'
                        ? t('screens.createRecipe.searchPlaceholderIngredients') // Show placeholder when query is empty
                        : t('screens.createRecipe.searchPlaceholderPreparations')}
                    </Text>
                   </View>
                )
              }
              // Added style for the list itself if needed
              style={styles.listStyle}
              contentContainerStyle={styles.listContentContainer} // Added for potential padding
            />
          )}

          {/* Create New button (Moved outside list, always visible, disabled if query is empty) */}
          <TouchableOpacity
            style={[
              styles.createNewButton,
              { marginTop: SIZES.padding }, // Ensure margin
              searchQuery.trim() === '' && styles.disabledButton, // Apply disabled style
            ]}
            disabled={searchQuery.trim() === ''} // Actual disable prop
            onPress={handleCreateNew}
          >
            <Text style={[styles.createNewButtonText, searchQuery.trim() === '' && styles.disabledButtonText]}>
              {searchQuery.trim() === ''
                ? (searchMode === 'ingredient'
                  ? t('screens.createRecipe.createIngredientButtonSimple')
                  : t('screens.createRecipe.createPreparationButtonSimple'))
                : (searchMode === 'ingredient'
                  ? t('screens.createRecipe.createIngredientButtonLabel', { query: searchQuery.trim() })
                  : t('screens.createRecipe.createPreparationButtonLabel', { query: searchQuery.trim() }))}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Add relevant styles from CreateRecipeScreen
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 1.5, // Slightly reduced padding
    width: '90%',
    maxHeight: '85%', // Slightly increased max height
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.white,
    marginBottom: SIZES.padding * 1.5,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base, // Reduced margin below search
    fontSize: SIZES.font,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchLoader: {
    marginVertical: SIZES.padding * 2,
    flex: 1, // Allow loader to take space if list is empty
  },
  listStyle: {
    flexGrow: 0, // Prevent FlatList from taking all space initially
    maxHeight: '60%', // Limit list height
  },
  listContentContainer: {
    paddingBottom: SIZES.base, // Add padding at the bottom of the list
  },
  modalItem: {
    paddingVertical: SIZES.padding * 0.8, // Slightly reduced item padding
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalItemText: {
    fontSize: SIZES.font,
    color: COLORS.white,
  },
  emptyListContainer: {
    paddingVertical: SIZES.padding * 2,
    alignItems: 'center', // Center text
  }, 
  emptyListText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  createNewButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderWidth: 1,
    padding: SIZES.padding * 0.9, // Slightly reduced padding
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginHorizontal: SIZES.padding, // Add horizontal margin
  },
  createNewButtonText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    opacity: 0.6, // Add opacity for disabled state
  },
  disabledButtonText: {
    color: COLORS.textLight,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: SIZES.padding, // Consistent margin
  },
  closeButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default ComponentSearchModal; 