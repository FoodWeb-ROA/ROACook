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
│   ├── constants/     # Constant values (theme, dimensions, etc.)
│   ├── context/       # React Context providers (e.g., AuthContext)
│   ├── data/          # Data structures or static data
│   ├── hooks/         # Custom React hooks
│   ├── locales/       # Internationalization (i18n) language files
│   ├── navigation/    # Navigation setup (React Navigation)
│   ├── screens/       # Application screens/views
│   ├── services/      # Services interacting with external APIs (e.g., Supabase)
│   ├── utils/         # Utility functions
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
*   **State Management:** React Context API (`AuthContext`)
*   **Backend Integration:** Supabase JS Client (`@supabase/supabase-js` ^2.49.3)
*   **Internationalization:** i18next, react-i18next, expo-localization
*   **Fonts:** Custom Poppins fonts (`expo-font`)
*   **Gestures:** `react-native-gesture-handler`
*   **Animations:** `react-native-reanimated`
*   **Utilities:** Expo Document Picker, Image Picker, Splash Screen, Status Bar, Action Sheet

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

*   **`App.tsx`:** The root component. Initializes fonts, sets up providers (SafeArea, Paper, Auth, ActionSheet), handles splash screen logic, and renders the `AppNavigator`.
*   **`src/navigation/AppNavigator.tsx`:** Defines the main navigation structure (likely using stack, tabs, or drawers) based on authentication state.
*   **`src/screens/`:** Contains individual screen components, representing different views within the app (e.g., `HomeScreen`, `RecipeDetailScreen`, `CreateRecipeScreen`).
*   **`src/components/`:** Houses reusable UI elements used across multiple screens (e.g., `Button`, `Card`, `Input`, `PreparationCard`, `ScaleSliderInput`).
*   **`src/context/AuthContext.tsx`:** Manages user authentication state and provides it to the rest of the application.
*   **`src/services/supabaseClient.ts` (or similar):** Configures and exports the Supabase client instance for database interactions. Look for files importing `@supabase/supabase-js`.
*   **`src/i18n.ts` & `src/locales/`:** Manages language translations and internationalization setup.
*   **NativeWind:** Used for styling via Tailwind CSS classes. Configuration might be in `tailwind.config.js` (if present) or integrated into `babel.config.js`.
*   **`src/types.ts`:** Central location for shared TypeScript interfaces and types, promoting consistency.

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

These are typically loaded from the `.env` file. Ensure this file is present and correctly configured before running the app or data management scripts.

## Build & Deployment (EAS)

The project is configured for EAS (Expo Application Services) builds, as indicated by `eas.json` and the `eas.projectId` in `app.json`.

*   Refer to EAS documentation for building and submitting the app: [https://docs.expo.dev/eas/](https://docs.expo.dev/eas/)
*   Commands typically involve `eas build --platform [ios|android] --profile [development|preview|production]`.

## Recent UI Changes Log (From Previous README)

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