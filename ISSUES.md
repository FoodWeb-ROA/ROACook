## Issue: Preparation Card Preview Not Showing Scaled Ingredients

*   **Date:** 2024-07-28
*   **Files:** `ROACook/src/screens/PreparationDetailScreen.tsx`, `ROACook/src/hooks/useSupabase.ts` (specifically `usePreparationDetail`), `ROACook/src/components/PreparationCard.tsx`
*   **Problem:** When viewing a preparation that contains another preparation as an ingredient (e.g., "Rich Beef Stock" containing "Mirepoix Prep Base"), the `PreparationCard` rendered for the nested preparation on the `PreparationDetailScreen` shows "No ingredients listed" instead of the scaled preview of its sub-ingredients. Realtime updates for these nested preparations are also inconsistent.
*   **Context:** This issue arose after refactoring the `seed.sql` data to support nested preparations and attempting to display them correctly on the `PreparationDetailScreen`.
*   **Current State:**
    *   `usePreparationDetail` fetches the immediate ingredients of a preparation. It then performs a separate query to identify which of these ingredients are themselves preparations, adding an `isPreparation` flag.
    *   `PreparationDetailScreen` uses this flag to filter ingredients into `nestedPreparations` and `rawIngredients`.
    *   It renders a `PreparationCard` for items in `nestedPreparations`, constructing a simplified `DishComponent`-like object (`prepComponentForCard`) to pass as a prop. This object lacks the detailed sub-ingredients of the nested preparation.
    *   Realtime updates for the parent preparation seem to work after fixing cache invalidation, but the nested card's content doesn't update correctly.
*   **Attempted Fixes (2024-07-28):**
    *   Added `isPreparation` flag detection logic to `usePreparationDetail`.
    *   Modified `PreparationDetailScreen` rendering logic to filter based on the flag and use `PreparationCard` for nested preps.
    *   Refined `isPreparation` detection in `usePreparationDetail` using a separate `SELECT preparation_id FROM preparations WHERE preparation_id IN (...)` query.
    *   Fixed cache invalidation issue in `usePreparationDetail` (added `queryClient.invalidateQueries({ queryKey });` after cache hit) which was showing stale data.
    *   Added extensive logging to `usePreparationDetail` and `PreparationDetailScreen` to trace data flow.
    *   Refined Realtime subscriptions in `useDishDetail` to specifically listen for changes in nested preparations and their ingredients/linked ingredients.
*   **Status:** Unresolved. The preview likely fails because `PreparationCard` requires the `preparationDetails.ingredients` array to be populated with the *nested* preparation's ingredients, which `usePreparationDetail` currently doesn't fetch for the sub-components. Realtime update inconsistency persists.

---

## Issue: Migrate Edit Screens (`CreateRecipeScreen`, `CreatePreparationScreen`) to New Data Flow

*   **Date:** 2024-07-28
*   **Files:** `ROACook/src/screens/CreateRecipeScreen.tsx`, `ROACook/src/screens/CreatePreparationScreen.tsx`, `ROACook/src/hooks/useSupabase.ts`, `ROACook/src/data/dbLookup.ts`, `ROACook/src/services/duplicateResolver.ts`
*   **Problem:** The screens for creating and editing dishes and preparations (`CreateRecipeScreen`, `CreatePreparationScreen`) were built before major refactoring of data fetching, state management (TanStack Query), Realtime updates, and duplicate resolution logic. They do not use the current, more robust data flow and utilities.
*   **Context:** Significant changes were made to `useSupabase.ts` hooks, caching, Realtime subscriptions, and helper functions for resolving/creating ingredients and preparations to fix various bugs and improve consistency. The edit/create screens haven't been updated accordingly.
*   **Required Changes:**
    *   Update screens to use the latest TanStack Query-based `useSupabase` hooks (`useDishDetail`, `usePreparationDetail`, `useIngredients`, etc.) for fetching initial data when editing.
    *   Replace internal/older duplicate checking and creation logic with the newer services (`resolveIngredient`, `resolvePreparation`, `resolveDish`, `createNewIngredient`, `createNewPreparation`, `fingerprintPreparation`).
    *   Ensure the data structures used and saved align with the latest `types.ts` definitions (e.g., `DishComponent`, `PreparationIngredient`).
    *   Integrate correctly with TanStack Query cache invalidation after saving changes to trigger UI updates elsewhere.
    *   Adapt UI components (like component lists) to handle the data format returned by the new hooks.
*   **Attempted Fixes:** None yet. This is a larger refactoring task identified after stabilizing the data fetching and display logic.
*   **Status:** Unresolved. Needs significant refactoring. 