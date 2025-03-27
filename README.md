# Recipe Management App

## Supabase Data Management

This project provides scripts to export and import data from/to your Supabase database. Follow these instructions to manage your data as JSON files.

### Prerequisites

- Node.js and npm installed
- Supabase URL and anonymous key (or JWT token)

### Installation

Make sure you have installed the dependencies:

```bash
npm install
```

### Exporting Data

You can export data from your Supabase database in multiple ways:

#### For Linux/Mac Users:

```bash
npm run export-unix "https://your-supabase-url.supabase.co" "your-supabase-anon-key"
```

Or directly:

```bash
./scripts/run-export.sh "https://your-supabase-url.supabase.co" "your-supabase-anon-key"
```

#### For Windows Users:

```bash
npm run export-win "https://your-supabase-url.supabase.co" "your-supabase-anon-key"
```

Or directly:

```bash
node scripts/run-export.js "https://your-supabase-url.supabase.co" "your-supabase-anon-key"
```

### Export Output

The exported data will be saved to the `exports` directory in the following format:

- Each table will be saved as a separate JSON file: `exports/[tableName].json`
- All tables will be saved in a single file: `exports/all-data.json`
- Recipes with related data will be saved as: `exports/recipes-with-related-data.json`

### Importing Data

You can import data into your Supabase database from previously exported JSON files:

#### For Linux/Mac Users:

```bash
npm run import-unix "https://your-supabase-url.supabase.co" "your-supabase-anon-key"
```

Or directly:

```bash
./scripts/run-import.sh "https://your-supabase-url.supabase.co" "your-supabase-anon-key"
```

#### For Windows Users:

```bash
npm run import-win "https://your-supabase-url.supabase.co" "your-supabase-anon-key"
```

Or directly:

```bash
node scripts/run-import.js "https://your-supabase-url.supabase.co" "your-supabase-anon-key"
```

### Import Notes

- The import process respects foreign key constraints by importing tables in the correct order.
- If you need to import data to a different database, make sure the schema is identical.
- Existing data with the same primary keys will cause conflicts unless handled by your Supabase configuration.

### Specialized Data Fetching

#### Detailed Recipes

To fetch recipes with full details (including all relations and nested data):

```bash
./scripts/run-fetch-recipes.sh "https://your-supabase-url.supabase.co" "your-supabase-anon-key"
```

This will generate a `detailed-recipes.json` file in the exports directory with a fully nested structure containing:

- Recipe details
- Menu section
- Ingredients with amounts
- Preparations with their ingredients

This format is particularly useful for displaying complete recipe information in the app.

## Running the App

To start the development server:

```bash
npm start
```

For specific platforms:

```bash
npm run android
npm run ios
npm run web
```