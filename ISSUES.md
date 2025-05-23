# ROACook Issues Log

## Issue: Preparation Self-Referencing During Save from Parser

**Description:** When parsing a recipe containing a preparation (e.g., "Cauliflower Mash") which itself contains an ingredient with a similar name (e.g., "cauliflower"), the ingredient is incorrectly resolved to the preparation itself during the pre-processing stage (`recipeProcessor.ts`). This leads to a self-referencing entry in the `preparation_components` table when the dish is saved.

**Status:** Unresolved (Persistent bad data likely)

**Attempted Fixes:**
*   Modified `recipeProcessor.ts` (`processParsedRecipe` function) to check if a matched sub-ingredient ID is the same as the parent preparation ID. If they match, the sub-ingredient is treated as unmatched. 
    *   **Result:** Logs confirmed this check worked correctly during pre-processing, and the sub-ingredient was marked as unmatched (`ingredient_id: null`). However, the self-reference still appears in the saved data, suggesting that either the save logic (`handleSaveDish`/`createNewPreparation`) incorrectly handles the `null` ID later, or (more likely) previously saved bad data in `preparation_components` is not being cleaned up by the current dish overwrite logic.

## Issue: Missing Time/Yield for Preparations When Saving Dish from Parser

**Description:** When saving a dish parsed from an image (e.g., "Cauliflower Shepherd's Pie"), the `total_time` and yield information (yield amount/unit) parsed for existing preparation components (e.g., "Cauliflower Mash") are not saved to the database. The `preparations.total_time` and corresponding `ingredients.amount`/`ingredients.unit_id` remain null or incorrect.

**Status:** Unresolved

**Attempted Fixes:**
1.  Modified `handleSaveDish` in `CreateDishScreen.tsx` to pass top-level state values for time (`totalTimeMinutes`) and yield (`servingSize`) to the `createNewPreparation` function.
    *   **Result:** Ineffective, as `createNewPreparation` is only called for *newly defined* preparations within the dish save flow, not for *existing* preparations identified by the parser.
2.  Added logic within the component processing loop in `handleSaveDish` to explicitly update the `preparations` table (`total_time`) and the `ingredients` table (`amount`, `unit_id` for yield) for components identified as existing preparations (`component.isPreparation && component.ingredient_id && component.originalPrep`).
    *   **Result:** Did not resolve the issue. The time and yield values still appear incorrect after saving.

## General Notes & Recommendations

*   The current `handleSaveDish` function has become very complex due to handling multiple cases (create/update dish, create/update/link preparations, resolving ingredients/preps, processing parsed data vs. manual edits). This complexity makes debugging difficult.
*   **Recommendation:** Refactor the entire recipe/preparation saving logic. Consider using Redux Toolkit (with Thunks or RTK Query) to manage the asynchronous operations, state updates, and complex nested data structures more robustly and predictably. This would likely involve dispatching actions to handle resolving components, creating/updating ingredients/preparations, and finally creating/updating the dish and its component links, with clearer state management throughout the process.
