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
*   **Status:** Unresolved. The preview likely fails because `PreparationCard` requires the
    `preparationDetails.ingredients` array to be populated with the *nested* preparation's
    ingredients, which `usePreparationDetail` currently doesn't fetch for the sub-components.
    Realtime update inconsistency persists.
