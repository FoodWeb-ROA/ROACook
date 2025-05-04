import { ParsedRecipe, ParsedIngredient, Unit, ComponentInput, EditablePrepIngredient } from '../types';
import { findCloseIngredient, checkPreparationNameExists } from '../data/dbLookup';
import { TFunction } from 'i18next'; // Assuming you use i18next

/**
 * Processes a raw parsed recipe from the AI parser into the ComponentInput[]
 * format needed by CreateRecipeScreen, performing initial lookups.
 */
export const processParsedRecipe = async (
    parsedRecipe: ParsedRecipe,
    units: Unit[],
    // Pass lookup functions as arguments
    findCloseIngredientFn: typeof findCloseIngredient, 
    checkPreparationNameExistsFn: typeof checkPreparationNameExists,
    t: TFunction // Pass translation function
): Promise<ComponentInput[]> => {
    console.log("[processParsedRecipe] Starting processing for recipe...");
    const mappedComponents: ComponentInput[] = [];
    
    // Build units map
    const unitsMap = new Map<string, string>();
    units.forEach((u: Unit) => {
        if (u.unit_name) unitsMap.set(u.unit_name.toLowerCase(), u.unit_id);
        if (u.abbreviation) unitsMap.set(u.abbreviation.toLowerCase(), u.unit_id);
    });
    console.log("[processParsedRecipe] Units map created with size:", unitsMap.size);

    if (!parsedRecipe.components || parsedRecipe.components.length === 0) {
        console.warn("[processParsedRecipe] Parsed recipe has no components.");
        return [];
    }

    for (const ing of parsedRecipe.components) {
        console.log(`[processParsedRecipe] Processing component: ${ing.name}`);
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
                    console.log(`  Matched ingredient: ${ing.name} -> ${matchedIngredient.name} (ID: ${matchedIngredient.ingredient_id})`);
                } else {
                     console.log(`  No close match found for ingredient: ${ing.name}`);
                }
            } else {
                // Lookup for existing preparations by name
                matchedPrepId = await checkPreparationNameExistsFn(ing.name);
                if (matchedPrepId) { 
                    console.log(`  Existing preparation found: ${ing.name} (ID: ${matchedPrepId})`);
                    matched = true; 
                } else {
                    console.log(`  No existing preparation found for: ${ing.name}. Will be treated as new.`);
                }
            }
        } catch (error) { 
            console.error(`[processParsedRecipe] Error matching component ${ing.name}:`, error); 
        }

        const parsedUnit = ing.unit?.toLowerCase().trim();
        if (parsedUnit) {
            matchedUnitId = unitsMap.get(parsedUnit) || null;
            console.log(`  Parsed unit: '${parsedUnit}', Matched unit ID: ${matchedUnitId}`);
        } else {
             console.log(`  No unit provided for component: ${ing.name}`);
        }

        let initialPrepStateIngredients: EditablePrepIngredient[] | null = null;
        let initialPrepStateUnitId: string | null = null;
        let initialPrepStateInstructions: string[] | null = null;

        if (ing.ingredient_type === 'Preparation') {
            initialPrepStateInstructions = ing.instructions || [];
            initialPrepStateUnitId = matchedUnitId; 
            initialPrepStateIngredients = [];
            if (ing.components && ing.components.length > 0) {
                 console.log(`  Processing ${ing.components.length} sub-components for preparation: ${ing.name}`);
                for (const subIng of ing.components) {
                    let subMatchedIngredient = null;
                    let subMatched = false;
                    let subMatchedUnitId: string | null = null;
                    try {
                        const subCloseMatches = await findCloseIngredientFn(subIng.name);
                        if (subCloseMatches.length > 0) {
                            subMatchedIngredient = subCloseMatches[0];
                            subMatched = true;
                            console.log(`    Matched sub-ingredient: ${subIng.name} -> ${subMatchedIngredient.name} (ID: ${subMatchedIngredient.ingredient_id})`);
                        } else {
                            console.log(`    No close match found for sub-ingredient: ${subIng.name}`);
                        }
                    } catch (error) { 
                        console.error(`[processParsedRecipe] Error matching sub-ingredient ${subIng.name}:`, error); 
                    }

                    const subParsedUnit = subIng.unit?.toLowerCase().trim();
                    if (subParsedUnit) {
                        subMatchedUnitId = unitsMap.get(subParsedUnit) || null;
                         console.log(`    Parsed sub-unit: '${subParsedUnit}', Matched sub-unit ID: ${subMatchedUnitId}`);
                    } else {
                        console.log(`    No unit provided for sub-ingredient: ${subIng.name}`);
                    }

                    initialPrepStateIngredients.push({
                        key: `prep-sub-${subIng.name}-${Date.now()}`,
                        ingredient_id: subMatched ? subMatchedIngredient?.ingredient_id : null,
                        name: subIng.name || '',
                        amountStr: String(subIng.amount ?? ''),
                        unitId: subMatchedUnitId,
                        isPreparation: false, // Sub-components within a prep are treated as ingredients here
                        unit: subIng.unit || '',
                        item: subIng.item || '',
                        matched: subMatched, 
                    } as any);
                }
            } else {
                 console.log(`  Preparation ${ing.name} has no sub-components defined in parsed data.`);
            }
        }

        // Determine the final ingredient ID string
        const finalIngredientId = matchedPrepId ? matchedPrepId : (matchedIngredient?.ingredient_id ? matchedIngredient.ingredient_id : null); // Use null if no ID found
         console.log(`  Final determined ID for ${ing.name}: ${finalIngredientId}`);

        if (!finalIngredientId) {
            console.warn(`[processParsedRecipe] Skipping component '${ing.name}' because it could not be resolved to an existing ingredient or preparation ID.`);
            continue; // Skip to the next component in the loop
        }

        mappedComponents.push({
            key: `parsed-${ing.name}-${Date.now()}`,
            ingredient_id: finalIngredientId, 
            name: matchedPrepId ? ing.name : (matchedIngredient?.name || ing.name), // Use matched name if available, else parsed name
            amount: String(ing.amount || ''), 
            unit_id: matchedUnitId, 
            isPreparation: ing.ingredient_type === 'Preparation',
            // Store the original parsed ingredient data if it's a preparation for later use
            originalPrep: ing.ingredient_type === 'Preparation' ? (ing as ParsedIngredient) : undefined,
            // Keep sub-ingredient state separate for clarity
            prepStateEditableIngredients: initialPrepStateIngredients,
            prepStatePrepUnitId: initialPrepStateUnitId, 
            prepStateInstructions: initialPrepStateInstructions,
            item: ing.item || null,
            matched: matched,
            // Remove subIngredients field, handled by prepStateEditableIngredients
        });
    } // End component loop
    
    console.log(`[processParsedRecipe] Finished processing. Mapped ${mappedComponents.length} components.`);
    return mappedComponents;
};