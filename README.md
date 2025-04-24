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
│   │   ├── UnitDisplay.tsx   # Component for displaying units with proper conversion
│   │   └── RecipeImage.tsx   # Component for displaying and managing recipe images
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
│   │   ├── api.ts             # Direct API communication service
│   │   ├── notionApi.ts       # Notion integration for feedback and error reporting
│   │   └── imageService.ts    # Services for managing recipe images
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
*   **State Management:** 
    *   **Client/UI State:** Redux Toolkit + Redux Saga (`src/store.ts`, `src/slices/`, `src/sagas/`)
    *   **Server State & Caching:** TanStack Query (React Query) v5 (`@tanstack/react-query`) with Supabase Cache Helpers (`@supabase-cache-helpers/postgrest-react-query`)
*   **Local Storage:** AsyncStorage for preferences
*   **Backend Integration:** Supabase JS Client (`@supabase/supabase-js` ^2.49.3)
*   **Realtime Updates:** Supabase Realtime subscriptions managed via Redux Saga (`src/sagas/kitchens/kitchensRealtimeSaga.ts`)
*   **Internationalization:** i18next, react-i18next, expo-localization
*   **Fonts:** Custom Poppins fonts (`expo-font`)
*   **Gestures:** `react-native-gesture-handler`
*   **Animations:** `react-native-reanimated`
*   **Media:** Expo Image Picker for camera and gallery access
*   **Image Generation:** Integration with Together AI for recipe image generation
*   **Utilities:** Expo Document Picker, Splash Screen, Status Bar, Action Sheet
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

*   **`App.tsx`:** Root component. Initializes fonts, sets up providers (Redux, React Query, SafeArea, Paper, Auth, UnitSystem, ActionSheet), error boundary, navigator.
*   **`src/components/ReactQueryClientProvider.tsx`:** Configures and provides the TanStack Query client.
*   **`src/store.ts`:** Configures Redux store and middleware (Redux Saga).
*   **`src/slices/`:** Redux Toolkit slices for managing client-side state (e.g., `authSlice`, `kitchensSlice` for `activeKitchenId`).
*   **`src/sagas/`:** Redux Saga files for handling side effects, including auth flows and realtime subscription management.
*   **`src/queries/`:** Contains reusable query functions (e.g., `getKitchensForUserQuery`) designed for use with `@supabase-cache-helpers/postgrest-react-query` and `useQuery`.
*   **`src/screens/`:** Screen components. Screens fetching data from Supabase now primarily use the `useQuery` hook (e.g., `ManageKitchensScreen.tsx`).
*   **`src/context/`:** React Context for global state not suited for Redux/React Query (e.g., `AuthContext`, `UnitSystemContext`).
*   **`src/services/supabaseClient.ts`:** Exports the configured Supabase client.
*   **`src/navigation/AppNavigator.tsx`:** Defines the main navigation structure (likely using stack, tabs, or drawers) based on authentication state.
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

## Data Fetching, Caching, and Realtime Updates

The application leverages TanStack Query (React Query) v5 along with `@supabase-cache-helpers/postgrest-react-query` for efficient server state management, caching, and automatic background updates.

*   **Fetching:** Data fetching from Supabase is primarily handled using the `useQuery` hook within screen/component files. Reusable query functions are defined in `src/queries/` (e.g., `src/queries/kitchenQueries.ts`). These functions take the Supabase client and necessary parameters (like `userId`) and return a Supabase query builder instance.
*   **Caching:** React Query automatically caches fetched data in memory. Default `staleTime` (5 min) and `gcTime` (30 min) are configured in `src/components/ReactQueryClientProvider.tsx`. This reduces unnecessary refetching and provides a snappier UI.
*   **Realtime Updates:**
    *   Supabase Realtime subscriptions are established for relevant tables (e.g., `kitchen`, `kitchen_users`) within a dedicated Redux Saga (`src/sagas/kitchens/kitchensRealtimeSaga.ts`).
    *   This saga listens for `INSERT`, `UPDATE`, and `DELETE` events pushed from the Supabase backend.
    *   Upon receiving an event, the saga identifies the relevant data potentially affected in the cache.
    *   It then uses the `queryClient.invalidateQueries({ queryKey: [...] })` method to mark the corresponding query cache entries as stale.
    *   Components subscribed to those queries via `useQuery` will automatically and efficiently refetch the updated data in the background when the cache is invalidated.
    *   The `queryKey` used for invalidation corresponds to the key structure generated by `@supabase-cache-helpers/postgrest-react-query` (often based on table name and filter parameters).
*   **State Management Mix:**
    *   **React Query:** Manages server state (data fetched from Supabase), including loading states, errors, caching, and background updates.
    *   **Redux:** Manages client-side UI state (e.g., authentication status, active kitchen ID, theme preferences) and orchestrates complex side effects via Sagas (auth flows, realtime subscription lifecycle).

This approach separates concerns, using React Query for what it excels at (server state) and Redux/Saga for client state and complex asynchronous workflows.

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

## Recent UI Changes Log

*   Added recipe image functionality with AI generation and user uploads
*   Integrated RecipeImage component into dish and preparation detail screens
*   Added image-related translations to all language files
*   Added unit system toggle (metric/imperial) in Preferences screen
*   Implemented UnitDisplay component for showing measurements in the user's preferred unit system
*   `CreateRecipeScreen` renders added preparations using read-only `PreparationCard`
*   `PreparationCard` in `CreateRecipeScreen` shows "Amount:" instead of "Yield:", sub-ingredients only shown if parsed/uploaded
*   `CreateRecipeScreen` has scale slider for servings, updates amounts dynamically, saves scaled amounts & target servings
*   `ScaleSliderInput` layout adjusted
*   Total yield displayed below servings slider in `CreateRecipeScreen`
*   `CreateRecipeScreen` title changed to "Confirm Parsed Recipe" for parsed recipes
*   Reduced vertical spacing around header/slider in `CreateRecipeScreen`
*   `CreateRecipeScreen` includes `serving_item` input for count-based units, with modal to select existing components
*   Quantities rounded to one decimal place in UI
*   Count units use item name, simple pluralization ('s', 'es' for 'ss') applied based on quantity
*   Fixed sub-ingredient capitalization in `PreparationCard` on confirmation screens

*(This section summarizes previous manual notes. Future changes should ideally be tracked via Git history and commit messages.)*
## Google Cloud Secret Manager Setup for Image Storage

The application uses Google Cloud Storage (GCS) for storing recipe images. To enhance security, credentials for GCS are stored in Google Cloud Secret Manager rather than hardcoded in the application or environment variables.

### Secret Manager Configuration

1. **Create the secrets in Google Cloud Secret Manager:**

We've provided a script to automate this process in `scripts/setup-gcs-secrets.sh`:

```bash
# Navigate to the scripts directory
cd scripts

# Make the script executable (if needed)
chmod +x setup-gcs-secrets.sh

# Run the script
./setup-gcs-secrets.sh
```

Or manually create the secrets:

```bash
# Install Google Cloud CLI if you haven't already
# https://cloud.google.com/sdk/docs/install

# Login to your Google Cloud account
gcloud auth login

# Set your project ID
gcloud config set project imperial-rarity-442220-c9

# Create the secrets
echo "user-recipe-image-worker@imperial-rarity-442220-c9.iam.gserviceaccount.com" | \
  gcloud secrets create user-recipe-image-worker-email --data-file=-

# Create the private key secret (replace with the actual private key)
gcloud secrets create user-recipe-image-worker-key --data-file=./image-store-gcs-key-private-key.txt
```

2. **Grant permissions to Supabase Edge Functions:**

The Supabase Edge Functions need permission to access the secrets. The specific service account depends on your Supabase setup. Consult the Supabase documentation for identifying the correct service account.

```bash
# Replace SERVICE_ACCOUNT with your Supabase Function's service account
gcloud secrets add-iam-policy-binding user-recipe-image-worker-email \
  --member="serviceAccount:SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding user-recipe-image-worker-key \
  --member="serviceAccount:SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

3. **Environment Variables (Alternative Setup):**

The application is designed to be flexible with credential sources. It checks for credentials in the following order:

1. Secret Manager (preferred)
2. Supabase Function environment variables
3. Fallback to direct environment variables

If you prefer to use environment variables instead of Secret Manager, you can set the following in your Supabase project:

```
# Direct Secret Manager access (preferred)
SECRET_USER_RECIPE_IMAGE_WORKER_EMAIL=user-recipe-image-worker@imperial-rarity-442220-c9.iam.gserviceaccount.com
SECRET_USER_RECIPE_IMAGE_WORKER_KEY=<the-private-key>

# OR use traditional environment variables (fallback)
GCS_CLIENT_EMAIL=user-recipe-image-worker@imperial-rarity-442220-c9.iam.gserviceaccount.com
GCS_PRIVATE_KEY=<the-private-key>
GCS_PROJECT_ID=imperial-rarity-442220-c9
```

### Testing Secret Manager Access

To verify that your Supabase Edge Functions can access Secret Manager, deploy the functions and check the logs for any errors related to Secret Manager access.

### Benefits of Using Secret Manager

- **Security**: Credentials are stored securely and not within application code
- **Access Control**: Fine-grained IAM permissions for who can access the secrets
- **Versioning**: Secret values can be versioned and rolled back if needed
- **Audit Logs**: All access to secrets is logged for security auditing
- **Rotation**: Secrets can be rotated without application changes

For more information on Google Cloud Secret Manager, see the [official documentation](https://cloud.google.com/secret-manager/docs/overview).
