import { ParsedRecipe, ParsedIngredient, Unit, ComponentInput, EditablePrepIngredient, Preparation } from '../types';
import { findCloseIngredient, checkPreparationNameExists } from '../data/dbLookup';
import { TFunction } from 'i18next'; // Assuming you use i18next
import { appLogger } from '../services/AppLogService';
import { PREPARATION_UNIT_ID } from '../constants/units'; // Corrected import path

/**
 * Processes a raw parsed recipe from the AI parser into the ComponentInput[]
 * format needed by CreateDishScreen, performing initial lookups.
 */
export const processParsedRecipe = async (
    parsedRecipe: ParsedRecipe,
    units: Unit[],
    // Pass lookup functions as arguments
    findCloseIngredientFn: typeof findCloseIngredient, 
    checkPreparationNameExistsFn: typeof checkPreparationNameExists,
    t: TFunction // Pass translation function
): Promise<ComponentInput[]> => {
    appLogger.log("[processParsedRecipe] Starting processing for recipe...");
    const mappedComponents: ComponentInput[] = [];
    
    // Build units map
    const unitsMap = new Map<string, string>();
    units.forEach((u: Unit) => {
        if (u.unit_name) unitsMap.set(u.unit_name.toLowerCase(), u.unit_id);
        if (u.abbreviation) unitsMap.set(u.abbreviation.toLowerCase(), u.unit_id);
    });
    appLogger.log("[processParsedRecipe] Units map created with size:", unitsMap.size);

    if (!parsedRecipe.components || parsedRecipe.components.length === 0) {
        appLogger.warn("[processParsedRecipe] Parsed recipe has no components.");
        return [];
    }

    for (const ing of parsedRecipe.components) {
        appLogger.log(`[processParsedRecipe] Processing component: ${ing.name}`);
        let matchedIngredient = null;
        let matched = false;
        let matchedUnitId: string | null = null;
        let matchedPrepId: string | null = null; // Variable to hold matched prep ID

        try {
            if (ing.ingredient_type !== 'Preparation') {
                // Lookup for raw ingredients
                const closeMatches = await findCloseIngredientFn(ing.name);
                if (closeMatches.length > 0) {
                    matchedIngredient = closeMatches[0];
                    matched = true;
                    appLogger.log(`  Matched ingredient: ${ing.name} -> ${matchedIngredient.name} (ID: ${matchedIngredient.ingredient_id})`);
                } else {
                     appLogger.log(`  No close match found for ingredient: ${ing.name}`);
                }
            } else {
                // Lookup for existing preparations by name
                matchedPrepId = await checkPreparationNameExistsFn(ing.name);
                if (matchedPrepId) { 
                    appLogger.log(`  Existing preparation found: ${ing.name} (ID: ${matchedPrepId})`);
                    matched = true; 
                } else {
                    appLogger.log(`  No existing preparation found for: ${ing.name}. Will be treated as new.`);
                }
            }
        } catch (error) { 
            appLogger.error(`[processParsedRecipe] Error matching component ${ing.name}:`, error); 
        }

        const parsedUnit = ing.unit?.toLowerCase().trim();
        if (parsedUnit) {
            matchedUnitId = unitsMap.get(parsedUnit) || null;
            appLogger.log(`  Parsed unit: '${parsedUnit}', Matched unit ID: ${matchedUnitId}`);
        } else {
             appLogger.log(`  No unit provided for component: ${ing.name}`);
        }

        let initialPrepStateIngredients: EditablePrepIngredient[] | null = null;
        let initialPrepStateUnitId: string | null = null;
        let initialPrepStateInstructions: string[] | null = null;

        if (ing.ingredient_type === 'Preparation') {
            initialPrepStateInstructions = ing.instructions || [];
            initialPrepStateUnitId = matchedUnitId; 
            initialPrepStateIngredients = [];
            if (ing.components && ing.components.length > 0) {
                 appLogger.log(`  Processing ${ing.components.length} sub-components for preparation: ${ing.name}`);
                for (const subIng of ing.components) {
                    let subMatchedIngredient = null;
                    let subMatched = false;
                    let subMatchedUnitId: string | null = null;
                    let subMatchedId: string | null = null; // Variable to hold the final ID

                    try {
                        const subCloseMatches = await findCloseIngredientFn(subIng.name);
                        if (subCloseMatches.length > 0) {
                            const potentialMatch = subCloseMatches[0];
                            // >>> CRITICAL FIX: Check if the matched ID is the same as the parent prep ID <<<
                            appLogger.log(`    [recipeProcessor] Checking sub-ing: ${subIng.name}. Potential match: ${potentialMatch.name} (${potentialMatch.ingredient_id}). Parent Prep ID: ${matchedPrepId}`);
                            if (potentialMatch.ingredient_id === matchedPrepId) {
                                appLogger.log(`    Sub-ingredient '${subIng.name}' matched parent prep ID '${matchedPrepId}'. Treating as unmatched.`);
                                // Do not set subMatchedIngredient or subMatchedId, leave them null/false
                            } else {
                                // Match is valid (not the parent prep)
                                subMatchedIngredient = potentialMatch;
                                subMatchedId = potentialMatch.ingredient_id; // Store the valid ID
                                subMatched = true;
                                appLogger.log(`    Matched sub-ingredient: ${subIng.name} -> ${subMatchedIngredient.name} (ID: ${subMatchedId})`);
                            }
                        } else {
                            appLogger.log(`    No close match found for sub-ingredient: ${subIng.name}`);
                        }
                    } catch (error) { 
                        appLogger.error(`[processParsedRecipe] Error matching sub-ingredient ${subIng.name}:`, error); 
                    }

                    const subParsedUnit = subIng.unit?.toLowerCase().trim();
                    if (subParsedUnit) {
                        subMatchedUnitId = unitsMap.get(subParsedUnit) || null;
                         appLogger.log(`    Parsed sub-unit: '${subParsedUnit}', Matched sub-unit ID: ${subMatchedUnitId}`);
                    } else {
                        appLogger.log(`    No unit provided for sub-ingredient: ${subIng.name}`);
                    }

                    initialPrepStateIngredients.push({
                        key: `prep-sub-${subIng.name}-${Date.now()}`,
                        ingredient_id: subMatchedId, // Use the validated/filtered ID
                        name: subIng.name || '',
                        amountStr: String(subIng.amount ?? ''),
                        unitId: subMatchedUnitId,
                        isPreparation: false, // Sub-components within a prep are treated as ingredients here
                        unit: subIng.unit || '',
                        item: subIng.item || '',
                        matched: subMatched, // Reflects if a *valid* match was found
                    } as any);
                }
            } else {
                 appLogger.log(`  Preparation ${ing.name} has no sub-components defined in parsed data.`);
            }
        }

        // Determine the final ingredient ID string
        const finalIngredientId = matchedPrepId ? matchedPrepId : (matchedIngredient?.ingredient_id ? matchedIngredient.ingredient_id : null); // Use null if no ID found
         appLogger.log(`  Final determined ID for ${ing.name}: ${finalIngredientId}`);

        // Determine amount and unit based on whether it's a preparation
        const isActualPreparation = ing.ingredient_type === 'Preparation';
        const finalAmount = isActualPreparation ? '1' : String(ing.amount || '');
        const finalUnitId = isActualPreparation ? PREPARATION_UNIT_ID : matchedUnitId;

        if (isActualPreparation) {
            appLogger.log(`  Component ${ing.name} is a Preparation. Overriding amount to '1' and unit to PREPARATION_UNIT_ID.`);
        }

        mappedComponents.push({
            key: `parsed-${ing.name}-${Date.now()}`,
            ingredient_id: finalIngredientId, 
            name: matchedPrepId ? ing.name : (matchedIngredient?.name || ing.name), // Use matched name if available, else parsed name
            amount: finalAmount, 
            unit_id: finalUnitId, 
            isPreparation: isActualPreparation,
            // Store the original parsed ingredient data if it's a preparation for later use
            originalPrep: isActualPreparation ? (ing as unknown as Preparation) : undefined,
            // Keep sub-ingredient state separate for clarity
            prepStateEditableIngredients: initialPrepStateIngredients,
            prepStatePrepUnitId: isActualPreparation ? PREPARATION_UNIT_ID : initialPrepStateUnitId, // Also ensure this reflects the override if it's a prep
            prepStateInstructions: initialPrepStateInstructions,
            item: ing.item || null,
            matched: matched,
            // Remove subIngredients field, handled by prepStateEditableIngredients
        });
    } // End component loop
    
    appLogger.log(`[processParsedRecipe] Finished processing. Mapped ${mappedComponents.length} components.`);
    return mappedComponents;
};