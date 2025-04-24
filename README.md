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
│   ├── exportData.ts
│   ├── importData.ts
│   ├── run-export.sh
│   ├── run-import.sh
│   └── ...
├── src/               # Main application source code
│   ├── components/    # Reusable UI components
│   │   ├── ErrorBoundary.tsx # Global error boundary component
│   │   └── UnitDisplay.tsx   # Component for displaying units with proper conversion
│   ├── constants/     # Constant values (theme, dimensions, etc.)
│   ├── context/       # React Context providers (e.g., AuthContext)
│   │   ├── AuthContext.tsx      # Authentication context
│   │   └── UnitSystemContext.tsx # Unit system preference (metric/imperial)
│   ├── data/          # Data structures or static data
│   ├── hooks/         # Custom React hooks
│   ├── locales/       # Internationalization (i18n) language files
│   ├── navigation/    # Navigation setup (React Navigation)
│   ├── screens/       # Application screens/views
│   ├── services/      # Services interacting with external APIs (e.g., Supabase)
│   │   ├── api.ts     # Direct API communication service
│   │   └── notionApi.ts # Notion integration for feedback and error reporting
│   ├── utils/         # Utility functions
│   │   └── errorReporting.ts # Error handling and reporting utilities
│   ├── i18n.ts        # i18next initialization
│   └── types.ts       # TypeScript type definitions
├── .env               # Environment variables (SUPABASE_URL, SUPABASE_ANON_KEY - **DO NOT COMMIT**)
├── .gitignore         # Files and directories ignored by Git
├── App.tsx            # Main application entry point component
├── app.json           # Expo application configuration
├── babel.config.js    # Babel configuration
├── eas.json           # EAS Build configuration
├── examples.txt       # Example data or usage notes
├── index.ts           # Entry point for Metro bundler
├── metro.config.js    # Metro bundler configuration
├── package-lock.json  # Exact dependency versions (npm)
├── package.json       # Project metadata and dependencies (npm)
├── tsconfig.json      # TypeScript compiler configuration
└── yarn.lock          # Exact dependency versions (yarn)
```

## Key Technologies & Libraries

*   **Framework:** Expo SDK (~52.0) / React Native (0.76.9)
*   **Language:** TypeScript
*   **UI Toolkit:** React Native Paper (^5.13.1), NativeWind (^4.1.23) (Tailwind for RN)
*   **Navigation:** React Navigation (^7.x) (Stack, Bottom Tabs, Drawer)
*   **State Management:** React Context API (`AuthContext`, `UnitSystemContext`)
*   **Local Storage:** AsyncStorage for preferences
*   **Backend Integration:** Supabase JS Client (`@supabase/supabase-js` ^2.49.3)
*   **Internationalization:** i18next, react-i18next, expo-localization
*   **Fonts:** Custom Poppins fonts (`expo-font`)
*   **Gestures:** `react-native-gesture-handler`
*   **Animations:** `react-native-reanimated`
*   **Utilities:** Expo Document Picker, Image Picker, Splash Screen, Status Bar, Action Sheet
*   **Error Reporting:** Custom Notion integration for error tracking and feedback

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

*   **`App.tsx`:** The root component. Initializes fonts, sets up providers (SafeArea, Paper, Auth, UnitSystem, ActionSheet), handles splash screen logic, wraps the application in an ErrorBoundary, and renders the `AppNavigator`.
*   **`src/navigation/AppNavigator.tsx`:** Defines the main navigation structure (likely using stack, tabs, or drawers) based on authentication state.
*   **`src/screens/`:** Contains individual screen components, representing different views within the app (e.g., `HomeScreen`, `RecipeDetailScreen`, `CreateRecipeScreen`).
*   **`src/components/`:** Houses reusable UI elements used across multiple screens (e.g., `Button`, `Card`, `Input`, `PreparationCard`, `ScaleSliderInput`, `UnitDisplay`).
*   **`src/context/AuthContext.tsx`:** Manages user authentication state and provides it to the rest of the application.
*   **`src/context/UnitSystemContext.tsx`:** Manages unit system preferences (metric or imperial) and provides conversion utilities.
*   **`src/services/supabaseClient.ts` (or similar):** Configures and exports the Supabase client instance for database interactions. Look for files importing `@supabase/supabase-js`.
*   **`src/i18n.ts` & `src/locales/`:** Manages language translations and internationalization setup.
    *   The French locale file (`src/locales/fr.json`) contains translation keys for all user-facing strings. Pluralization and context-specific keys are included under relevant sections (e.g., `common`).
    *   **Recent update:** The plural key for 'preparation' (`"preparations": "Préparations"`) was added under the `common` section to support correct plural display in French UI components and lists.
*   **NativeWind:** Used for styling via Tailwind CSS classes. Configuration might be in `tailwind.config.js` (if present) or integrated into `babel.config.js`.
*   **`src/types.ts`:** Central location for shared TypeScript interfaces and types, promoting consistency.

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

## Error Handling & Reporting

The application includes a comprehensive error handling and reporting system that captures both caught and uncaught errors and submits them to a Notion database for tracking:

*   **`src/components/ErrorBoundary.tsx`:** React error boundary component that catches unhandled errors in the component tree, displays a fallback UI, and reports errors to Notion.
*   **`src/utils/errorReporting.ts`:** Provides utility functions and hooks for handling and reporting errors from anywhere in the application:
    *   `handleError`: Global error handler function for use outside of React components
    *   `useErrorHandler`: React hook for error handling within functional components
    *   `createErrorHandler`: Creates higher-order functions to handle API call errors
    *   `withErrorHandling`: Utility to wrap async functions with error handling
*   **`src/services/notionApi.ts`:** Provides functions to submit both user feedback and error reports to Notion:
    *   `submitFeedback`: Submits user feedback from the help screen
    *   `submitErrorReport`: Submits error reports with stack traces and additional context
    *   `reportError`: Utility for creating component-specific error handlers
*   **`src/services/api.ts`:** Handles direct communication with the Notion API:
    *   `submitToNotion`: Core function that formats and submits data to the Notion database

To use error reporting in your code:

```typescript
// In functional components:
const { handleError } = useErrorHandler();

try {
  // Risky operation
} catch (error) {
  handleError(error, {
    componentName: 'YourComponent', 
    showAlert: true, 
    severity: 'medium'
  });
}

// Or with higher-order functions:
const apiWithErrorHandling = createErrorHandler('ApiService')(yourApiCall);

// Or by wrapping async functions:
const safeFunction = withErrorHandling(riskyFunction, {
  componentName: 'ServiceName',
  showAlert: false,
  severity: 'high'
});
```

## Data Management Scripts (`scripts/`)

The `scripts/` directory contains Node.js scripts (using `ts-node`) for interacting with the Supabase database directly, primarily for backup and potentially seeding purposes.

*   **Exporting:** `exportData.ts` (run via `npm run export-unix` or `npm run export-win`) fetches data from specified Supabase tables and saves it to JSON files in an `exports/` directory (this directory should likely be in `.gitignore`). It can export individual tables, all tables combined, and a detailed nested recipe structure.
*   **Importing:** `importData.ts` (run via `npm run import-unix` or `npm run import-win`) reads data from the JSON files in `exports/` and inserts it into the Supabase database, respecting table dependencies.
*   **Fetching Detailed Recipes:** `run-fetch-recipes.sh` uses a specific script (likely wrapping `exportData.ts` or a dedicated fetch script) to generate `detailed-recipes.json` containing deeply nested recipe data.

**Usage:**

```bash
# Example Export (Unix/Mac)
npm run export-unix "YOUR_SUPABASE_URL" "YOUR_SUPABASE_ANON_KEY"

# Example Import (Windows)
npm run import-win "YOUR_SUPABASE_URL" "YOUR_SUPABASE_ANON_KEY"

# Example Fetch Detailed Recipes (Unix/Mac)
./scripts/run-fetch-recipes.sh "YOUR_SUPABASE_URL" "YOUR_SUPABASE_ANON_KEY"
```

*(Refer to the original README section for specific script command details if needed)*

## Environment Variables

*   `SUPABASE_URL`: The URL of your Supabase project.
*   `SUPABASE_ANON_KEY`: The anonymous (public) key for your Supabase project.
*   `EXPO_PUBLIC_NOTION_API_KEY`: API key for Notion integration (error reporting and feedback).
*   `EXPO_PUBLIC_NOTION_DATABASE_ID`: Notion database ID where errors and feedback are stored.

These are typically loaded from the `.env` file. Ensure this file is present and correctly configured before running the app or data management scripts.

## Build & Deployment (EAS)

The project is configured for EAS (Expo Application Services) builds, as indicated by `eas.json` and the `eas.projectId` in `app.json`.

*   Refer to EAS documentation for building and submitting the app: [https://docs.expo.dev/eas/](https://docs.expo.dev/eas/)
*   Commands typically involve `eas build --platform [ios|android] --profile [development|preview|production]`.

## Recent UI Changes Log (From Previous README)

*   Added unit system toggle (metric/imperial) in Preferences screen.
*   Implemented UnitDisplay component for showing measurements in the user's preferred unit system.
*   `CreateRecipeScreen` renders added preparations using read-only `PreparationCard`.
*   `PreparationCard` in `CreateRecipeScreen` shows "Amount:" instead of "Yield:", sub-ingredients only shown if parsed/uploaded.
*   `CreateRecipeScreen` has scale slider for servings, updates amounts dynamically, saves scaled amounts & target servings.
*   `ScaleSliderInput` layout adjusted.
*   Total yield displayed below servings slider in `CreateRecipeScreen`.
*   `CreateRecipeScreen` title changed to "Confirm Parsed Recipe" for parsed recipes.
*   Reduced vertical spacing around header/slider in `CreateRecipeScreen`.
*   `CreateRecipeScreen` includes `serving_item` input for count-based units, with modal to select existing components.
*   Quantities rounded to one decimal place in UI.
*   Count units use item name, simple pluralization ('s', 'es' for 'ss') applied based on quantity.
*   Fixed sub-ingredient capitalization in `PreparationCard` on confirmation screens.

*(This section summarizes previous manual notes. Future changes should ideally be tracked via Git history and commit messages.)*