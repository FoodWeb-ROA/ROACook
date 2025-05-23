# ROACook Technical Documentation

## 1. Overview

ROACook is a comprehensive mobile application meticulously designed for the intuitive management of recipes, ingredients, and broader kitchen-related data. It empowers users with the ability to seamlessly create, view, dynamically scale, and efficiently organize their culinary creations and their constituent components. The application is developed using React Native, leveraging the Expo framework for a streamlined development experience, and relies on Supabase for its robust backend infrastructure, encompassing database services, authentication, and potentially real-time features.

This document serves as an in-depth technical guide for developers, outlining the application's architecture, data flow, core functionalities, interactions with external services, and setup procedures. Its goal is to provide a clear understanding of the application's internals to facilitate ongoing development, maintenance, and onboarding of new team members.

## 2. Architecture

The ROACook application is built upon a modular architectural paradigm, emphasizing a strong separation of concerns to enhance maintainability, scalability, and testability. This architecture primarily integrates React Native for the user interface, Redux for predictable global state management, React Query for efficient server state synchronization, and Supabase for all backend operations.

### 2.1. Core Technologies & Rationale

- **Frontend:** React Native (with Expo)
  - **Rationale:** Chosen for its cross-platform capabilities, allowing for a single codebase to target both iOS and Android, significantly reducing development time and effort. Expo further simplifies development by managing build configurations, providing a rich set of pre-built native modules (e.g., camera, file system), offering Over-The-Air (OTA) updates for rapid deployment of fixes and features, and streamlining the submission process to app stores.
- **State Management (Global):** Redux with Redux Toolkit and Redux Saga.
  - **Rationale:** Redux provides a centralized store for global application state, such as user authentication status, active kitchen context, and UI preferences. This ensures a single source of truth and predictable state transitions. Redux Toolkit is utilized to simplify Redux development with best practices like Immer for immutable updates (reducing boilerplate and potential errors) and `createSlice` for generating reducers and action creators concisely. Redux Saga is employed to manage complex asynchronous operations and side effects (e.g., login sequences, multi-step data fetching/processing not directly tied to server state) in a more testable and manageable way than thunks, especially for intricate workflows involving multiple API calls or conditional logic.
  - `redux-persist` is integrated to persist critical global state (e.g., authentication tokens, user's active kitchen ID) to `AsyncStorage`. This ensures a seamless user experience across app sessions, as users don't have to re-authenticate or re-select their kitchen every time they open the app.
- **State Management (Server):** React Query (`@tanstack/react-query`)
  - **Rationale:** Selected for its powerful capabilities in fetching, caching, synchronizing, and updating server state. It significantly reduces the amount of boilerplate code needed for data fetching compared to manual Redux-based approaches for server data. Features like automatic refetching on window focus or network reconnect, stale-while-revalidate caching strategies, optimistic updates, and query invalidation simplify the challenge of keeping the UI in sync with backend data and improve perceived performance.
  - It leverages `@supabase-cache-helpers/postgrest-react-query` for optimized integration with Supabase, providing utilities that understand Supabase's PostgREST API structure for cache key generation and data manipulation, further streamlining development.
- **Backend:** Supabase
  - **Rationale:** An open-source Firebase alternative, Supabase offers a suite of backend tools including a PostgreSQL database, authentication, instant APIs (PostgREST), edge functions (serverless functions), real-time subscriptions, and storage. Its ease of use, auto-generated APIs based on the database schema, and integrated services make it an excellent choice for rapid development and scalable applications without the need to manage complex backend infrastructure.
- **Navigation:** React Navigation (`@react-navigation`)
  - **Rationale:** The de-facto standard for navigation in React Native applications. It provides a flexible and extensible solution for managing screen transitions, supporting various navigation patterns like stack navigators (for hierarchical navigation), drawer navigators (for main menu access), and tab navigators, all of which are utilized within ROACook to create an intuitive user flow.
- **Unit Handling:** Custom logic within `src/utils/unitHelpers.ts`
  - **Rationale:** Unit interpretation, conversion, and normalization are centralized in `src/utils/unitHelpers.ts`. This module employs a simplified, custom approach using predefined conversion factors for weight (`WEIGHT_FACTORS`) and volume (`VOLUME_FACTORS`) units (e.g., grams to kilograms, ml to liters). It does **not** use external libraries like `js-quantities`. This approach provides direct control over supported units and conversion logic, tailored specifically to the application's needs. The system handles a special `PREPARATION_UNIT_ABBR` ('prep') which signifies a preparation used as a component, treated as a unitless multiplier in scaling rather than a convertible unit. The focus is on storing user-entered units and normalizing them for display rather than enforcing a global user-selected unit system.
- **Internationalization (i18n):** `i18next` with `react-i18next`.
  - **Rationale:** Provides a comprehensive framework for translating the application into multiple languages, enhancing its accessibility and potential user base. It supports features like pluralization, context, and interpolation.
- **Logging:** Custom `AppLogService` (`src/services/AppLogService.ts`)
  - **Rationale:** A dedicated service for application-level logging. This allows for consistent log formatting (e.g., timestamps, log levels) and provides a central point for potentially integrating with external monitoring and error reporting services (e.g., Sentry, or the existing Notion integration for errors), facilitating easier debugging and issue tracking.

### 2.2. Directory Structure (Key `src` Folders Explained)

- `src/assets`: Contains static resources such as images (icons, placeholders, illustrations), custom fonts, and potentially other static files used throughout the application.
- `src/components`: Houses reusable UI components (e.g., `AppHeader.tsx`, `UnitDisplay.tsx`, `IngredientCard.tsx`, `CustomButton.tsx`) that are used across multiple screens. This promotes code reuse, consistent UI/UX, and easier maintenance of visual elements.
- `src/constants`: Stores global constants, including theme definitions (colors, font sizes, spacing units in `theme.ts`), API endpoint keys (if not solely in .env), and other application-wide static values that don't change at runtime (e.g., `PREPARATION_UNIT_ID`, `PREPARATION_UNIT_ABBR` in `src/constants/units.ts`).
- `src/context`: (Previously used for `UnitSystemContext.tsx`). This directory is now largely deprecated for unit handling, as this logic has been centralized in `src/utils/unitHelpers.ts`. It might still be used for other specific, localized React context needs if they arise.
- `src/data`:
  - `supabaseClient.ts`: The single source of truth for initializing and configuring the Supabase JavaScript client. It handles environment variables for Supabase credentials and sets up default options, including `AsyncStorage` for auth persistence, ensuring a consistent client instance is used app-wide.
  - `database.types.ts`: Contains TypeScript definitions automatically generated from the Supabase database schema. This enables strong typing for all database interactions.
  - `queryClient.ts`: Initializes and configures the React Query client instance (`QueryClient`).
- `src/hooks`: Defines custom React hooks to encapsulate reusable logic, particularly for stateful logic, side effects, and interactions with Supabase/React Query (e.g., `useDishDetail.ts`, `usePreparationDetail.ts`, `useCurrentKitchenId.ts`).
- `src/locales`: Contains JSON files for internationalization.
- `src/navigation`: Configures the application's navigation structure using React Navigation.
  - `AppNavigator.tsx`: The main navigation component.
  - `types.ts`: Defines TypeScript types for navigation parameters.
- `src/queries`: Contains functions that define specific Supabase queries for use with React Query.
- `src/sagas`: Contains Redux Sagas for managing complex asynchronous operations.
- `src/screens`: Contains top-level components for each distinct screen (e.g., `HomeScreen.tsx`, `DishDetailScreen.tsx`, `PreparationDetailScreen.tsx`).
- `src/services`:
  - `AppLogService.ts`: Centralized logging utility.
  - `DataPrefetchService.ts`: Proactively fetches and caches essential data.
  - `notionService.ts`: Manages integration with Notion for support tickets and logs.
  - `recipeParser.ts`: Client for the external `multimodal-recipe-parser` API.
- `src/slices`: Contains Redux Toolkit "slices" for global state management.
- `src/store.ts`: Configures the Redux store.
- `src/types.ts`: Defines core TypeScript interfaces and types for the application's data models (e.g., `Dish`, `Ingredient`, `Preparation`, `Unit`).
- `src/utils`:
  - `unitHelpers.ts`: The central module for all unit conversion and normalization logic. (See detailed explanation in Data Flow section).
  - `transforms.ts`: Contains data transformation functions (Supabase raw data to app-specific types).
  - `textFormatters.ts`: Utility functions for formatting text, numbers, and quantities for display.
  - `recipeProcessor.ts`: Processes data from the `multimodal-recipe-parser` API.

## 3. Data Flow and Management

The application employs a sophisticated data management strategy, combining Supabase for backend persistence, React Query for server state caching and synchronization, and Redux for global UI and session state.

### 3.1. Supabase Interaction

- **Client Initialization:** The Supabase JavaScript client is initialized in `src/data/supabaseClient.ts`.
- **Authentication:** Supabase Auth is used for user management.
- **Database Operations:** Data is stored in PostgreSQL, accessed via PostgREST API using the Supabase JS client's query builder.
- **Typed Queries:** `database.types.ts` enables strongly typed queries.

### 3.2. Data Fetching and Caching with React Query

- **Server State Authority:** React Query is the source of truth for backend data.
- **Custom Hooks:** Data fetching logic is encapsulated in custom hooks (e.g., `useDishDetail`, `usePreparationDetail` in `src/hooks/useSupabase.ts`).
- **Query Keys:** Consistent query key strategy for caching and invalidation.
- **Prefetching Strategy (`DataPrefetchService.ts`):** Minimizes latency by pre-loading essential data.
- **Data Transformation (`transforms.ts`):** Maps raw Supabase data (e.g., `FetchedDishData`, `FetchedPreparationDataCombined`) to application-specific domain model types (e.g., `Dish`, `Preparation` defined in `src/types.ts`). This layer is crucial for decoupling and maintainability.

### 3.3. Global State with Redux

- **Scope:** Manages client-side global state (auth status, active kitchen, UI preferences) via slices like `authSlice.ts` and `kitchensSlice.ts`.
- **Sagas (`src/sagas/`):** Handle complex asynchronous workflows and side effects.

### 3.4. Unit Handling (`src/utils/unitHelpers.ts`)

This module has been significantly refactored to provide a self-contained, simplified approach to unit management, moving away from external libraries like `js-quantities` and a global user-selectable unit system.

- **Centralization:** All logic for unit interpretation, conversion, and normalization resides in `src/utils/unitHelpers.ts`.
- **Custom Conversion Logic:**
  - Employs internal, hardcoded conversion factor maps: `WEIGHT_FACTORS` (base: grams) and `VOLUME_FACTORS` (base: milliliters) for common culinary units.
  - The `convertAmount(amount, fromUnitRaw, toUnitRaw)` function performs conversions between compatible units within the same measurement kind (weight or volume). If units are incompatible or not found in the factor maps, it returns the original amount.
- **Preparation as a Unitless Multiplier:**
  - A special constant `PREPARATION_UNIT_ABBR` (value: 'prep') is defined (see `src/constants/units.ts`).
  - When a preparation is used as a component in a dish, its 'unit' is effectively this 'prep' identifier.
  - The `convertAmount` function explicitly bypasses conversion for 'prep' units, treating them as direct multipliers for scaling purposes rather than convertible physical units.
  - The `Unit` type in `src/types.ts` includes 'preparation' as a possible `measurement_type`.
- **Normalization for Display:**
  - The `normalizeAmountAndUnit(amount, unitAbbr)` function adjusts an amount and its unit to a more human-readable form (e.g., 1500g to 1.5kg, or 0.5kg to 500g) based on predefined thresholds. This is used primarily for display clarity.
  - It also respects the `PREPARATION_UNIT_ABBR`, returning the amount and unit unchanged.
- **No Global Unit System Preference:** The application no longer relies on a user-selectable global unit system (metric/imperial) for display. Instead, it aims to store amounts in their originally entered units and uses `normalizeAmountAndUnit` to present them clearly. Conversions via `convertAmount` are typically for specific, explicit needs rather than a blanket system-wide display change.
- **Key Functions:**
  - `unitKind(unit: Unit)`: Determines the measurement kind (e.g., 'weight', 'volume', 'count', 'preparation') of a unit object. This is derived from the `measurement_type` property of the `Unit` type.
  - `convertAmount(...)`: Converts amounts between compatible units.
  - `normalizeAmountAndUnit(...)`: Adjusts amounts and units for better readability.

## 4. Core Features & Logic

### 4.1. Recipe Management (Dishes)

- **Creation/Editing (`CreateDishScreen.tsx`, `EditDishScreen.tsx`):** Users input dish details, components (ingredients/preparations), and directions.
- **Details Display (`DishDetailScreen.tsx`):** Comprehensive view of a dish, including metadata, components, and directions. Amounts and units are formatted for clarity using `formatQuantityAuto` (which internally may use `normalizeAmountAndUnit`).
- **Scaling Functionality (`DishDetailScreen.tsx`):
  - Users adjust desired servings (`targetServings`) from the dish's original servings (`originalServings`).
  - A `servingScale` factor is calculated: `servingScale = targetServings / originalServings`.
  - The amounts of each `DishComponent` are multiplied by this `servingScale`.
  - If a `DishComponent` is a preparation (i.e., its unit is effectively 'prep'), its amount (which represents how many 'units' of the preparation's base yield are needed) is scaled directly by `servingScale`. The scaling of the preparation's own internal ingredients is then handled within the `PreparationDetailScreen` or when the preparation component is processed, using this `servingScale` passed down.
  - Displayed scaled amounts are normalized using `normalizeAmountAndUnit` for readability.

### 4.2. Ingredient and Preparation Management

- **Ingredients (`Ingredient` type):** Basic culinary items. Managed via screens like `IngredientListScreen.tsx`.
- **Preparations (`Preparation` type):** Reusable sub-recipes (e.g., "Pizza Dough"). Each has its own ingredients, directions, and a base yield (though yield is not directly used for scaling in the new model; scaling is based on the 'prep' unit as a multiplier).
  - **Details Display (`PreparationDetailScreen.tsx`):** Shows preparation ingredients and directions. If navigated from a dish, it can receive `recipeServingScale` and `prepAmountInDish` to correctly display scaled ingredient quantities for that context. The scaling of its internal ingredients is based on the `recipeServingScale` multiplied by any scaling inherent to the `prepAmountInDish` relative to the preparation's base definition.

## 5. External Services

### 5.1. Supabase

- **Primary Backend:** PostgreSQL database, Authentication, Storage (optional), Instant APIs (PostgREST).
- **Schema:** Defined in `src/data/database.types.ts`.

### 5.2. Notion (via `src/services/notionService.ts`)

- **Support Tickets & Logging:** Integrates with Notion for creating support tickets and detailed application log entries in designated Notion databases.
- **Functionality:** `createAppLogEntryPage` (for detailed logs), `createNotionTicketEntry` (for main tickets), `reportToNotion` (orchestrator).
- **Configuration:** Requires `EXPO_PUBLIC_NOTION_API_KEY`, `EXPO_PUBLIC_NOTION_DATABASE_ID`, `EXPO_PUBLIC_NOTION_APP_LOGS_DATABASE_ID` environment variables.

### 5.3. Multimodal Recipe Parsing API

- **Functionality:** Allows users to create recipes from images by extracting structured data (name, ingredients, instructions).
- **API Client (`src/services/recipeParser.ts`):** Handles communication with the external parsing service (endpoint via `EXPO_PUBLIC_RECIPE_PARSER_URL`).
- **Data Processing (`src/utils/recipeProcessor.ts`):** Interprets the API response and integrates it into the application's data model, matching ingredients and units. If an ingredient or preparation from the parsed recipe does not match an existing entry in the database, it is now included in the processed output (with its `ingredient_id` set to `null` and a `matched` flag set to `false`), allowing the user interface to prompt for its creation rather than being silently skipped.

## 6. Key Files & Modules Summary

- **App Entry & Setup:** `App.tsx`, `src/store.ts`, `src/navigation/AppNavigator.tsx`.
- **Supabase Client & Types:** `src/data/supabaseClient.ts`, `src/data/database.types.ts`.
- **React Query Client:** `src/data/queryClient.ts`.
- **Data Prefetching:** `src/services/DataPrefetchService.ts`.
- **Data Transformations:** `src/utils/transforms.ts`.
- **Unit Logic & Scaling:** `src/utils/unitHelpers.ts`, `src/screens/DishDetailScreen.tsx`, `src/screens/PreparationDetailScreen.tsx`.
- **Core Types:** `src/types.ts`.
