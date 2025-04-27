

## Issue 1: Duplicate Name Constraint Violation & Cancel Path

**Reported:** 2024-07-27

**Error Logs:**
```
(NOBRIDGE) ERROR  Error saving recipe: {"code": "23505", "details": "Key (dish_name)=(...) already exists.", ..., "message": "duplicate key value violates unique constraint ..."}
```

**Analysis:**
1.  When saving a new dish/preparation with a name that already exists, the database threw a unique constraint violation (23505) instead of the user being prompted by the `resolveDish`/`resolvePreparation` functions.
2.  The `resolveDish` function in `duplicateResolver.ts` incorrectly resolved the "Cancel" action as `{ mode: 'new' }`, causing the save flow to continue and hit the constraint error.
3.  The `handleSaveDish` function in `CreateRecipeScreen.tsx` didn't explicitly handle the `cancel` mode and didn't ensure the insert path was only taken when the resolution mode was truly `new`.

**Attempted Fixes (2024-07-27):**
1.  **`src/services/duplicateResolver.ts`:**
    *   Modified `resolveDish` to resolve the `Cancel` action with `{ mode: 'cancel' }`.
2.  **`src/screens/CreateRecipeScreen.tsx`:**
    *   Updated `handleSaveDish` to check for `dishResolution.mode === 'cancel'` and abort the save if true.
    *   Ensured the `overwrite` logic path correctly updates the dish and returns.
    *   Ensured the insert logic only proceeds if `dishResolution.mode === 'new'`.

**Status:** Attempted Fix

## Issue 3: Supabase Schema Cache Errors (Column Mismatch)

**Reported:** 2024-07-27

**Error Logs:**
```
(NOBRIDGE) ERROR  Error saving recipe: {"code": "PGRST204", ..., "message": "Could not find the 'is_preparation' column of 'dish_components' in the schema cache"}
(NOBRIDGE) ERROR  Error saving recipe: {"code": "PGRST204", ..., "message": "Could not find the 'item' column of 'dish_components' in the schema cache"}
```

**Analysis:**
1.  The code was attempting to insert data into `dish_components` using column names (`is_preparation`, `item`) that did not exist in the database schema.
2.  Investigation revealed the `is_preparation` column doesn't exist (preparation status is inferred). The `item` column should be `piece_type`.

**Attempted Fixes (2024-07-27):**
1.  **`src/screens/CreateRecipeScreen.tsx`:**
    *   Removed the `is_preparation` field from the data mapping for `dish_components` inserts.
    *   Corrected the mapping to use `piece_type: c.item || null` instead of `item: c.item`.

**Status:** Attempted Fix

## Issue 4: Incomplete Preparation Creation Logic (Reference Ingredient)

**Reported:** 2024-07-27

**Analysis:**
1.  The `reference_ingredient` field was parsed correctly into component state but wasn't being saved when a *new* preparation was implicitly created during a *dish save* operation.
2.  The component processing logic within `handleSaveDish` was incomplete and didn't call `createNewPreparation` with the necessary data (including `reference_ingredient`).

**Attempted Fixes (2024-07-27):**
1.  **`src/screens/CreateRecipeScreen.tsx`:**
    *   Implemented the component processing logic within the `components.map` block in `handleSaveDish`.
    *   Added calls to `resolvePreparation` and `createNewPreparation` for new preparations.
    *   Ensured `createNewPreparation` is called with `reference_ingredient: comp.reference_ingredient ?? null`.

**Status:** Attempted Fix

## Issue 5: Preparation Reference Ingredient Not Saving

**Reported:** 2024-07-27

**Analysis:** Ongoing issue despite previous fixes, potentially related to how `reference_ingredient` is handled in the `preparations` table vs. `ingredients` table during creation/updates, or how it's passed between screens/components.

**Status:** Open

## Issue 6: Edit Dish Not Correctly Populating Preparation Info

**Reported:** 2024-07-27

**Analysis:** When navigating to `CreateRecipeScreen` to edit an existing dish containing preparations, the preparation-specific details (sub-ingredients, instructions stored in `prepState...` fields) might not be loading correctly from the fetched `dishToEdit` data.

**Status:** Open

## Issue 7: Persistent Text Formatting Error in CreatePreparationScreen

**Reported:** 2024-07-27

**Analysis:** A text formatting or display error persists in `CreatePreparationScreen.tsx`, likely related to how scaled amounts or units are calculated or rendered, possibly involving the reference ingredient logic.

**Status:** Open 