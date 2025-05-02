# ROACook - Recipe Management Mobile App (Internal Developer Documentation)

## Overview

`ROACook` is a mobile application built using the Expo framework with React Native and TypeScript. It serves as the primary user interface for managing and interacting with recipes. The application connects to a Supabase backend for data persistence and utilizes various libraries for navigation, UI components, styling, and internationalization.

## Project Structure

```
ROACook/
├── .expo/             # Expo development cache and logs
├── .git/              # Git repository data
├── .vscode/           # VSCode workspace settings
├── assets/            # Static assets (fonts, images)
│   ├── fonts/
│   └── *.png
├── node_modules/      # Project dependencies
├── scripts/           # Utility scripts (e.g., data import/export)
├── src/               # Main application source code
│   ├── components/    # Reusable UI components
│   ├── constants/     # Constant values (theme, dimensions, etc.)
│   ├── context/       # React Context providers
│   ├── data/          # Data structures or static data
│   ├── hooks/         # Custom React hooks (including data fetching)
│   ├── locales/       # Internationalization (i18n) language files
│   ├── navigation/    # Navigation setup (React Navigation)
│   ├── persistence/   # Offline storage utilities
│   │   └── offlineRecipes.ts # Individual recipe caching logic
│   ├── realtime/      # Realtime subscription helpers
│   │   └── supabaseChannelHelpers.ts # Supabase channel subscription helper
│   ├── sagas/         # Redux Saga middleware for side effects
│   │   ├── auth/         # Authentication flow sagas
│   │   ├── kitchens/     # Kitchen management sagas (incl. realtime)
│   │   ├── dishes/       # Dish realtime update saga
│   │   ├── ingredients/  # Ingredient realtime update saga
│   │   ├── preparations/ # Preparation realtime update saga
│   │   └── rootSaga.ts   # Root saga combining all sagas
│   ├── screens/       # Application screens/views
│   ├── services/      # Services interacting with external APIs
│   ├── slices/        # Redux Toolkit state slices
│   ├── store.ts       # Redux store configuration
│   ├── utils/         # Utility functions (transforms, formatting, etc.)
│   ├── i18n.ts        # i18next initialization
│   └── types.ts       # TypeScript type definitions
├── .env               # Environment variables (**DO NOT COMMIT**)
├── .gitignore         # Files and directories ignored by Git
├── App.tsx            # Main application entry point component
├── app.json           # Expo application configuration
├── babel.config.js    # Babel configuration
├── eas.json           # EAS Build configuration
├── metro.config.js    # Metro bundler configuration
├── package.json       # Project metadata and dependencies
├── tsconfig.json      # TypeScript compiler configuration
└── ...                # Other config files (yarn.lock, etc.)
```

## Key Technologies & Libraries

*   **Framework:** Expo SDK / React Native
*   **Language:** TypeScript
*   **UI Toolkit:** React Native Paper, NativeWind (Tailwind for RN)
*   **Navigation:** React Navigation (Stack, Bottom Tabs, Drawer)
*   **State Management:**
    *   **Client/UI State:** Redux Toolkit + Redux Saga (`src/store.ts`, `src/slices/`, `src/sagas/`)
    *   **Server State & Caching:** TanStack Query (React Query) v5 (`@tanstack/react-query`)
*   **Persistence:**
    *   `redux-persist` for Redux state (`auth`, `kitchens` slices).
    *   `@tanstack/react-query-persist-client` + `@tanstack/query-async-storage-persister` for React Query cache.
    *   Custom `AsyncStorage` caching for individual recipes (`src/persistence/offlineRecipes.ts`).
*   **Local Storage:** AsyncStorage
*   **Backend Integration:** Supabase JS Client (`@supabase/supabase-js`)
*   **Realtime Updates:** Supabase Realtime + Redux Saga
*   **Internationalization:** i18next, react-i18next, expo-localization
*   **Fonts:** `expo-font`
*   **Gestures & Animations:** `react-native-gesture-handler`, `react-native-reanimated`
*   **Media:** `expo-image-picker`
*   **Image Generation:** Together AI via Supabase Edge Functions
*   **Error Reporting:** Custom Notion integration

## Setup & Running

1.  **Install Dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
2.  **Environment Variables:**
    *   Create a `.env` file in the `ROACook` root directory.
    *   Add your Supabase URL and Anon Key:
        ```dotenv
        SUPABASE_URL=YOUR_SUPABASE_URL
        SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
        # Notion integration (for error reporting and feedback)
        EXPO_PUBLIC_NOTION_API_KEY=YOUR_NOTION_API_KEY
        EXPO_PUBLIC_NOTION_DATABASE_ID=YOUR_NOTION_DATABASE_ID
        ```
    *   *Note:* Ensure `.env` is listed in `.gitignore`.
3.  **Start the Development Server:**
    ```bash
    npm start
    # or
    yarn start
    ```
4.  **Run on Device/Emulator:**
    *   Follow the instructions in the terminal after running `npm start`. You can run on Android, iOS, or Web.
    *   `npm run android` / `yarn android`
    *   `npm run ios` / `yarn ios`
    *   `npm run web` / `yarn web`

## Core Components & Concepts

*   **`App.tsx`:** Root component. Initializes providers...
*   **`src/components/ReactQueryClientProvider.tsx`:** Configures and provides the TanStack Query client, including persistence setup.
*   **`src/store.ts`:** Configures Redux store, middleware (Saga), and persistence.
*   **`src/slices/`:** Redux Toolkit slices...
*   **`src/sagas/`:** Redux Saga files for side effects (auth, realtime management). See `rootSaga.ts` for structure.
*   **`src/hooks/`:** Custom hooks, including data fetching hooks (`useDishes`, `usePreparationDetail`, etc.) using TanStack Query.
*   **`src/context/`:** React Context...
*   **`src/services/supabaseClient.ts`:** Exports the configured Supabase client.
*   **`src/persistence/offlineRecipes.ts`:** Helpers for caching individual recipe details in AsyncStorage.
*   **`src/realtime/supabaseChannelHelpers.ts`:** Reusable helper for managing Supabase Realtime channel subscriptions.
*   **`src/screens/`:** Contains individual screen components, representing different views within the app (e.g., `HomeScreen`, `RecipeDetailScreen`, `CreateRecipeScreen`).
*   **`src/components/`:** Houses reusable UI elements used across multiple screens:
    *   `Button`, `Card`, `Input`: Basic UI elements
    *   `PreparationCard`, `ScaleSliderInput`, `UnitDisplay`: Recipe-specific components
    *   `RecipeImage`: Component for displaying and managing recipe images, handling uploads from camera/gallery and AI generation
*   **`src/context/AuthContext.tsx`:** Manages user authentication state and provides it to the rest of the application.
*   **`src/context/UnitSystemContext.tsx`:** Manages unit system preferences (metric or imperial) and provides conversion utilities.
*   **`src/services/imageService.ts`:** Handles image operations for recipes, including:
    *   Getting image URLs for dishes and preparations
    *   Uploading images from the device's camera or gallery
    *   Generating images using AI via Supabase Edge Functions
*   **`src/i18n.ts` & `src/locales/`:** Manages language translations and internationalization setup.
*   **NativeWind:** Used for styling via Tailwind CSS classes. Configuration might be in `tailwind.config.js` (if present) or integrated into `babel.config.js`.
*   **`src/types.ts`:** Central location for shared TypeScript interfaces and types, promoting consistency.

## Data Fetching, Caching, and Realtime Updates

This section details the application's strategy for managing server state, persistence, and live data updates.

### State Management Approach

The application employs a hybrid approach:

*   **Redux Toolkit (+ Redux Saga):** Manages global client-side UI state (e.g., authentication status, active kitchen ID, theme preferences) and orchestrates complex asynchronous workflows like authentication and **non-realtime** kitchen management (fetching lists, leaving kitchens).
*   **TanStack Query (React Query) v5:** Manages server state fetched from the Supabase backend. It handles caching, background updates, loading/error states, and optimizes data fetching via hooks like `useQuery` located in `src/hooks/`. Query keys generally follow the pattern `[tableName, { filterKey: filterValue }]` (e.g., `['dishes', { kitchen_id: '...' }]`).

### Caching & Persistence

Multiple layers of caching are used to improve performance and provide offline capabilities:

1.  **React Query In-Memory Cache:** TanStack Query automatically caches fetched data in memory. Default `staleTime` (30 min) and `gcTime` (30 min) are configured in `src/data/queryClient.ts`.
2.  **React Query Persisted Cache:**
    *   The entire React Query cache is persisted to `AsyncStorage` using `@tanstack/react-query-persist-client` and `@tanstack/query-async-storage-persister` (configured in `src/components/ReactQueryClientProvider.tsx`).
    *   The cache key in `AsyncStorage` is `rq-cache`.
    *   Hydration occurs on cold starts, followed by background revalidation based on `staleTime`.
    *   This cache is cleared on user logout (`logoutSaga.ts`).
3.  **Offline Recipe Cache:**
    *   To ensure recently viewed recipes are quickly available even if the main RQ cache is garbage collected or stale, individual dish and preparation details are saved separately to `AsyncStorage` upon successful fetching in `useDishDetail` and `usePreparationDetail` hooks.
    *   Logic is handled by helpers in `src/persistence/offlineRecipes.ts`.
    *   These individual caches provide fast initial data hydration for recipe detail screens and basic offline viewing.
    *   This cache is also cleared on user logout (`logoutSaga.ts`).
4.  **Redux Persisted State:**
    *   `redux-persist` saves parts of the Redux state (`auth`, `kitchens` slices) to `AsyncStorage`.
    *   Configuration is in `src/store.ts`.
    *   This is purged on logout (`logoutSaga.ts`).

### Realtime Updates via Supabase & React Query (Revised Sept 2024)

The application listens for database changes in realtime using Supabase and directly updates the React Query cache:

*   **Subscription Management:** The `src/realtime/useSupabaseRealtime.ts` hook manages the connection to a single Supabase Realtime channel (`kitchen-{activeKitchenId}`).
    *   It subscribes/unsubscribes automatically based on the user's authentication state and active kitchen ID (selected via Redux).
    *   It listens for `INSERT`, `UPDATE`, `DELETE` events on relevant tables (`kitchen`, `kitchen_users`, `dishes`, `ingredients`, `preparations`, `preparation_ingredients`, `menu_section`, `dish_components`).
    *   Includes basic exponential backoff retry logic for connection errors.
    *   The hook is activated globally via the `<SupabaseRealtimeProvider>` in `App.tsx`.
*   **Cache Updates:** Upon receiving an event, the `useSupabaseRealtime` hook calls the `applyRealtimeEvent` function in `src/realtime/cacheInvalidation.ts`.
    *   `applyRealtimeEvent` determines the appropriate cache keys to update based on the incoming event's table and data.
    *   It uses `queryClient.invalidateQueries({ queryKey: [...] })` to mark relevant data as stale.
*   **Automatic Refetching:** Components using TanStack Query hooks (`useQuery`) subscribed to the invalidated query keys will automatically and efficiently refetch the updated data in the background or display the updated data immediately if surgical cache updates (using `setQueryData`) are implemented in the future.

This setup replaces the previous Redux Saga-based realtime handling, simplifying the data flow and leveraging React Query's caching mechanisms more directly.

### Data Saving & Duplicate Handling (Revised July 2024)

*   **Centralized Resolution:** Duplicate checking for ingredients, dishes, and preparations is handled by the functions `resolveIngredient`, `resolveDish`, and `resolvePreparation` in `src/services/duplicateResolver.ts`.
*   **User Prompts:** When potential duplicates are detected (e.g., similar ingredient names, exact dish/preparation names), these resolver functions present the user with `Alert` prompts offering choices like "Use Existing", "Create New", "Replace", or "Rename".
*   **Dish/Prep Creation Flow (`CreateRecipeScreen.tsx`):**
    *   The `handleSaveDish` function now integrates with `resolveDish` and `resolvePreparation` before attempting inserts.
    *   It handles different resolution modes (`existing`, `new`, `overwrite`, `rename`, `cancel`) to guide the saving process (update existing record, insert new, rename and insert, or abort).
    *   Implicit creation of *new* preparations (identified during recipe parsing) during a *dish save* operation now correctly calls `createNewPreparation`, passing necessary data including `piece_type` (for sub-components).
*   **Schema Corrections:** Save logic has been updated to use correct database column names (e.g., `piece_type` instead of `item` in `dish_components`) and avoids attempting to write to non-existent columns.
*   **Reference Ingredient Removal:** As of November 2024, the `reference_ingredient` field has been removed from the codebase. Preparations now always have a logical amount and unit, and ingredient amounts are scaled based on the ratio of the preparation's yield.

## Recipe Image Management

The application includes a comprehensive system for managing recipe images:

*   **`src/components/RecipeImage.tsx`:** A reusable component for displaying and managing recipe images:
    *   Displays existing images for dishes and preparations
    *   Provides an interface for uploading custom images from the camera or gallery
    *   Offers an option to generate images using AI
    *   Handles loading and error states with appropriate UI feedback

*   **`src/services/imageService.ts`:** Provides utility functions for managing recipe images:
    *   `pickImage`: Opens the device's camera or gallery to select an image
    *   `uploadRecipeImage`: Uploads an image to Supabase Storage and updates the database
    *   `getRecipeImageUrl`: Retrieves the URL of a recipe image from the database
    *   `generateRecipeImage`: Triggers AI image generation for a recipe

*   **Image Generation:** New dishes and preparations automatically have images generated if they don't already have one. This happens through a Supabase Edge Function that:
    1. Extracts recipe details (name, ingredients, directions)
    2. Creates a prompt for Together AI, an image generation service
    3. Uploads the generated image to Cloud Storage
    4. Updates the database with the image URL

*   **User-Uploaded Images:** Users can override AI-generated images by uploading their own photos through the camera or gallery. These are stored in Supabase Storage.

## Unit System Management

The application supports both metric and imperial units with seamless conversion between them:

*   **`src/context/UnitSystemContext.tsx`:** Manages the user's preferred unit system and provides conversion utilities:
    *   `useUnitSystem()` hook for accessing the current unit system and utility functions
    *   `convertWeight()`, `convertVolume()`, and `convertTemperature()` functions for unit conversions
    *   `getUnitLabel()` for getting the appropriate unit label based on the unit system
    *   Unit system preference is persisted using AsyncStorage
*   **`src/components/UnitDisplay.tsx`:** A specialized component for displaying quantities with the appropriate unit system:
    ```tsx
    <UnitDisplay value={500} unit="g" />
    // Displays "500 g" in metric mode or "17.6 oz" in imperial mode
    ```
*   **Unit conversions supported:**
    *   Weight: g ↔ oz, kg ↔ lb
    *   Volume: ml ↔ fl oz, l ↔ qt
    *   Temperature: °C ↔ °F
    *   Length: mm/cm ↔ in, m ↔ ft

The user can toggle between metric and imperial units from the Preferences screen. This preference is stored locally and applies throughout the app.

## Data Management Scripts (`scripts/`)

The `scripts/` directory contains Node.js scripts (using `ts-node`) for interacting with the Supabase database directly, primarily for backup and potentially seeding purposes.

*   **Exporting:** `exportData.ts` (run via `npm run script:export`) fetches data from specified Supabase tables and saves it to JSON files in an `exports/` directory (this directory should likely be in `.gitignore`). It can export individual tables, all tables combined, and a detailed nested recipe structure.
*   **Importing:** `importData.ts` (run via `npm run script:import`) reads data from the JSON files in `exports/` and inserts it into the Supabase database, respecting table dependencies.
*   **Fetching Detailed Recipes:** `fetchDetailedRecipes.ts` (run via `npm run script:fetch-recipes`) generates `detailed-recipes.json` containing deeply nested recipe data.

**Usage:**

```bash
# Export Data
npm run script:export -- --url "YOUR_SUPABASE_URL" --key "YOUR_SUPABASE_ANON_KEY"

# Import Data
npm run script:import -- --url "YOUR_SUPABASE_URL" --key "YOUR_SUPABASE_ANON_KEY"

# Fetch Detailed Recipes
npm run script:fetch-recipes -- --url "YOUR_SUPABASE_URL" --key "YOUR_SUPABASE_ANON_KEY"
```

*(Refer to the `package.json` for exact script definitions)*

## Environment Variables

*   `SUPABASE_URL`: The URL of your Supabase project.
*   `