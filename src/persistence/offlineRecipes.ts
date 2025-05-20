import AsyncStorage from '@react-native-async-storage/async-storage';
import { DishComponent, PreparationIngredient, Unit } from '../types'; // Assuming these are the base types needed
import { appLogger } from '../services/AppLogService';

// Define the structure for a cached dish
export interface OfflineDishPayload {
  schemaVersion: number; // For future migrations
  fetchedAt: number; // Timestamp of when data was fetched
  // --- Dish Details ---
  dish_id: string;
  dish_name: string;
  directions: string | null;
  total_time: string | null; // Assuming HH:MM:SS format from DB
  serving_size: number | null;
  serving_unit_id: string | null;
  serving_unit?: Unit | null; // Include the unit details if available
  num_servings: number; // Use num_servings from FetchedDishData
  cooking_notes: string | null;
  serving_item: string | null; // Add serving_item
  // --- Components ---
  components: DishComponent[]; // Use the transformed DishComponent type
}

// Define the structure for a cached preparation
export interface OfflinePreparationPayload {
  schemaVersion: number;
  fetchedAt: number;
  // --- Preparation Details (from ingredients + preparations tables) ---
  preparation_id: string; // which is also an ingredient_id
  name: string; // from ingredients table
  directions: string | null; // from preparations table
  total_time: number | null; // from preparations table (total minutes?)
  yield_amount: number | null; // from ingredients table? (Needs verification based on usePrepDetail)
  yield_unit_id: string | null; // from ingredients table?
  yield_unit?: Unit | null; // Include unit details if available
  cooking_notes: string | null; // from ingredients table?
  fingerprint?: string | null; // Add fingerprint if available
  // --- Components (from preparation_ingredients) ---
  ingredients: PreparationIngredient[]; // Use the transformed PreparationIngredient type
}

export type OfflineRecipePayload = OfflineDishPayload | OfflinePreparationPayload;

const CACHE_PREFIX_DISH = 'offlineRecipe_dish_';
const CACHE_PREFIX_PREP = 'offlineRecipe_prep_';
const CURRENT_SCHEMA_VERSION = 1;

const getCacheKey = (id: string, kind: 'dish' | 'prep'): string => {
  return kind === 'dish' ? `${CACHE_PREFIX_DISH}${id}` : `${CACHE_PREFIX_PREP}${id}`;
};

/**
 * Saves a fully fetched dish or preparation details to AsyncStorage.
 */
export async function saveOfflineRecipe(
  id: string,
  kind: 'dish' | 'prep',
  payload: OfflineRecipePayload // Use the combined type
): Promise<void> {
  if (!id) {
    appLogger.warn('[saveOfflineRecipe] Attempted to save recipe with invalid ID.');
    return;
  }
  const cacheKey = getCacheKey(id, kind);
  try {
    // Add schema version and timestamp before saving
    const dataToStore = {
      ...payload,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      fetchedAt: Date.now(),
    };
    const jsonValue = JSON.stringify(dataToStore);
    await AsyncStorage.setItem(cacheKey, jsonValue);
    appLogger.log(`[saveOfflineRecipe] Saved ${kind} ${id} to offline cache.`);
  } catch (e) {
    appLogger.error(`[saveOfflineRecipe] Failed to save ${kind} ${id} to AsyncStorage:`, e);
  }
}

/**
 * Retrieves a cached dish or preparation from AsyncStorage.
 * Returns null if not found, expired, or schema mismatch.
 */
export async function getOfflineRecipe(
  id: string,
  kind: 'dish' | 'prep'
): Promise<OfflineRecipePayload | null> {
   if (!id) return null;
   const cacheKey = getCacheKey(id, kind);
   try {
     const jsonValue = await AsyncStorage.getItem(cacheKey);
     if (jsonValue == null) {
       return null; // Not cached
     }

     const cachedData: OfflineRecipePayload & { schemaVersion?: number; fetchedAt?: number } = JSON.parse(jsonValue);

     // Validate schema version (optional but recommended)
     if (cachedData.schemaVersion !== CURRENT_SCHEMA_VERSION) {
       appLogger.warn(`[getOfflineRecipe] Schema mismatch for ${kind} ${id}. Discarding cache.`);
       await AsyncStorage.removeItem(cacheKey); // Clear outdated cache
       return null;
     }

     appLogger.log(`[getOfflineRecipe] Retrieved ${kind} ${id} from offline cache.`);
     // Cast back to the expected payload type after checks
     return cachedData as OfflineRecipePayload;
   } catch (e) {
     appLogger.error(`[getOfflineRecipe] Failed to retrieve ${kind} ${id} from AsyncStorage:`, e);
     // Attempt to clear potentially corrupted data
     try {
        await AsyncStorage.removeItem(cacheKey);
     } catch (clearError) {
        appLogger.error(`[getOfflineRecipe] Failed to clear corrupted cache for key ${cacheKey}:`, clearError);
     }
     return null;
   }
}

/**
 * Removes a cached dish or preparation from AsyncStorage.
 */
export async function purgeOfflineRecipe(
  id: string,
  kind: 'dish' | 'prep'
): Promise<void> {
  if (!id) return;
  const cacheKey = getCacheKey(id, kind);
  try {
    await AsyncStorage.removeItem(cacheKey);
    appLogger.log(`[purgeOfflineRecipe] Removed ${kind} ${id} from offline cache.`);
  } catch (e) {
    appLogger.error(`[purgeOfflineRecipe] Failed to remove ${kind} ${id} from AsyncStorage:`, e);
  }
}

/**
 * Clears ALL offline recipe caches. Use with caution (e.g., on logout).
 */
export async function purgeAllOfflineRecipes(): Promise<void> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const recipeKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX_DISH) || key.startsWith(CACHE_PREFIX_PREP));
        if (recipeKeys.length > 0) {
            await AsyncStorage.multiRemove(recipeKeys);
            appLogger.log(`[purgeAllOfflineRecipes] Cleared ${recipeKeys.length} offline recipe caches.`);
        }
    } catch (e) {
        appLogger.error('[purgeAllOfflineRecipes] Failed to clear offline recipe caches:', e);
    }
} 