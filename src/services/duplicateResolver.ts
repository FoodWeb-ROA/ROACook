import { Alert } from 'react-native';
import { findCloseIngredient, findDishByName, checkPreparationNameExists, findPreparationByFingerprint } from '../data/dbLookup';

export type ResolutionMode = 'existing' | 'new' | 'overwrite' | 'rename' | 'cancel';
export interface ResolutionResult {
  mode: ResolutionMode;
  id?: string | null;
  newName?: string;
}

/**
 * Resolve duplicate ingredients.
 */
export async function resolveIngredient(
  name: string,
  t: (key: string, opts?: any) => string
): Promise<ResolutionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { mode: 'new' };

  try {
    const matches = await findCloseIngredient(trimmed);
    // Check for an exact case-insensitive match first
    const exact = matches.find(m => m.name.toLowerCase() === trimmed.toLowerCase());
    if (exact) {
        console.log(`Exact ingredient match found for "${trimmed}", using ID: ${exact.ingredient_id}`);
        return { mode: 'existing', id: exact.ingredient_id }; // Use existing silently
    }

    // If no exact match, but similar matches exist, prompt the user
    if (matches.length > 0) {
      return new Promise(res => {
        const best = matches[0]; // Offer the closest match
        Alert.alert(
          t('alerts.similarIngredientFoundTitle'),
          t('alerts.similarIngredientFoundMessage', { entered: trimmed, found: best.name }),
          [
            { text: t('common.useExisting'), onPress: () => res({ mode: 'existing', id: best.ingredient_id }) },
            { text: t('common.createNew'), style: 'destructive', onPress: () => res({ mode: 'new' }) },
          ],
          { cancelable: false } // Force a choice
        );
      });
    }
    // No exact or similar matches found
    return { mode: 'new' };
  } catch (e) {
    console.error('resolveIngredient error', e);
    // Fallback to creating new on error
    return { mode: 'new' };
  }
}

/** Resolve duplicate dishes */
export async function resolveDish(
  name: string,
  t: (key: string, opts?: any) => string
): Promise<ResolutionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { mode: 'new' };
  try {
    // findDishByName checks for an exact match
    const id = await findDishByName(trimmed);
    if (!id) return { mode: 'new' }; // No exact match found, treat as new

    // Exact match found, prompt for overwrite/cancel
    return new Promise(res => {
      Alert.alert(
        t('alerts.duplicateNameTitle'),
        t('alerts.duplicateDishReplaceMessage', { name: trimmed }),
        [
          { text: t('common.replace'), onPress: () => res({ mode: 'overwrite', id }) },
          { text: t('common.cancel'), style: 'cancel', onPress: () => res({ mode: 'cancel' }) },
        ],
        { cancelable: false }
      );
    });
  } catch (e) {
    console.error('resolveDish error', e);
    return { mode: 'new' };
  }
}

/** Resolve duplicate preparations */
export async function resolvePreparation(
  name: string,
  fingerprint: string | null,
  parentDishName: string | null,
  t: (key: string, opts?: any) => string
): Promise<ResolutionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { mode: 'new' };
  try {
    // 1. Check for identical content (fingerprint) first
    if (fingerprint) {
      const fpId = await findPreparationByFingerprint(fingerprint);
      if (fpId) {
        console.log(`Exact preparation content match found for "${trimmed}" via fingerprint, using ID: ${fpId}`);
        // If content is identical, just use the existing one. No need to prompt.
        return { mode: 'existing', id: fpId }; 
    }
    }
    // 2. If no fingerprint match, check for exact name match
    const nameId = await checkPreparationNameExists(trimmed);
    if (!nameId) {
        // No identical content and no name collision, treat as new.
        return { mode: 'new' }; 
    }

    // 3. Exact name match found, but content is different. Prompt user.
    return new Promise(res => {
      Alert.alert(
        t('alerts.duplicateNameTitle'),
        t('alerts.duplicatePrepMessage', { name: trimmed }), // Message indicating name exists, content differs
        [
          { text: t('common.replace'), onPress: () => res({ mode: 'overwrite', id: nameId }) },
          {
            text: t('common.rename'),
            onPress: () => {
              const newName = parentDishName ? `${trimmed} (${parentDishName})` : `${trimmed} (${t('common.variant')})`;
              res({ mode: 'rename', newName });
            },
          },
          { text: t('common.cancel'), style: 'cancel', onPress: () => res({ mode: 'new' }) }, // Treat cancel as aborting this prep save
        ],
        { cancelable: false }
      );
    });
  } catch (e) {
    console.error('resolvePreparation error', e);
    return { mode: 'new' }; // Fallback to new on error
  }
} 