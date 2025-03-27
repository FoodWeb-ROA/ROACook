# Dynamic Database Queries in Recipe Management App

This document explains how the Recipe Management App implements dynamic queries to the Supabase database, loading only the data needed for each screen or component.

## Architecture

The app uses a layered approach to database access:

1. **Supabase Client Layer** - `src/data/supabaseClient.ts`
   - Establishes connection to Supabase
   - Initialized with environment variables

2. **Type Definitions** - `src/data/database.types.ts`
   - TypeScript types that match the Supabase database schema
   - Ensures type safety when querying the database

3. **Data Utilities** - `src/data/dataUtils.ts`
   - Generic CRUD operations for tables
   - Specialized functions for complex queries

4. **Data Hooks** - `src/hooks/useSupabase.ts`
   - React hooks for data fetching
   - Handle loading, error states, and data transformations
   - Component-specific data needs

5. **Authentication** - `src/context/AuthContext.tsx`
   - Manages user session state
   - Handles login, registration, and logout
   - Controls access to protected screens

## Data Flow

1. Components use the appropriate hooks to request data
2. Hooks fetch only the data needed for that component
3. Data is cached in component state
4. Loading and error states are managed by the hooks

## Examples

### Fetching Recipes for Home Screen

```jsx
// In HomeScreen.tsx
const { recipes, loading, error } = useRecipes();

// Display loading indicator while data is being fetched
if (loading) {
  return <LoadingIndicator />;
}

// Display error message if fetch failed
if (error) {
  return <ErrorMessage message={error.message} />;
}

// Render the recipes
return (
  <RecipeList recipes={recipes} />
);
```

### Fetching Recipe Details

```jsx
// In RecipeDetailScreen.tsx
const { recipeId } = route.params;
const { 
  recipe, 
  ingredients, 
  preparations, 
  menuSection, 
  loading, 
  error 
} = useRecipeDetail(recipeId);

// Use the data to render the recipe detail view
```

## Benefits

1. **Performance** - Only loading the data needed for each screen
2. **Reduced Network Usage** - Minimizing data transfer
3. **Better UX** - Loading indicators for each data fetch
4. **Modularity** - Components only request what they need
5. **Type Safety** - TypeScript ensures correct data types

## Implementing a New Feature

To add a new feature that requires database access:

1. Add any necessary types to `database.types.ts`
2. Create a new hook in `useSupabase.ts` for the specific data need
3. Use the hook in your component

## Authentication Flow

1. App checks for existing session on startup
2. If no session, user is directed to login
3. After login, session is stored and user accesses protected screens
4. Real-time session updates via Supabase subscription 