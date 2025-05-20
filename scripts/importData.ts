import fs from 'fs';
import path from 'path';
import { supabase } from '../src/data/supabaseClient';
import { Database } from '../src/data/database.types'; // Import Database type

// Define a type for valid table names
type TableName = keyof Database['public']['Tables'];

// This function will import data from a JSON file into a Supabase table
async function importTableData(tableName: TableName, filePath: string) {
  try {
    // Read the JSON file
    const fileData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileData);
    
    if (!Array.isArray(data) || data.length === 0) {
      appLogger.log(`No data found in ${filePath} or data is not an array.`);
      return;
    }
    
    appLogger.log(`Importing ${data.length} records into ${tableName}...`);
    
    // --- Data Pre-processing --- 
    let processedData = data;
    if (tableName === 'dishes') {
        appLogger.log(`Preprocessing data for table: ${tableName}`);
        processedData = data.map((dish: any) => {
            let intervalString = '00:00:00'; // Default interval
            // Check if total_time is a number (e.g., minutes)
            if (typeof dish.total_time === 'number' && dish.total_time >= 0) {
                const totalMinutes = Math.round(dish.total_time);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                intervalString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
                appLogger.log(`  Dish '${dish.dish_name}': Converted total_time ${dish.total_time} mins to ${intervalString}`);
            } 
            // Check if total_time is already a string (potentially correct format)
            else if (typeof dish.total_time === 'string') {
                // Basic check if already formatted H:M:S - add more robust parsing if needed
                if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(dish.total_time)) {
                    // Assuming HH:MM or HH:MM:SS - Ensure HH:MM:SS format
                    const parts = dish.total_time.split(':');
                    intervalString = `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}:${parts[2] ? String(parts[2]).padStart(2, '0') : '00'}`;
                    if (dish.total_time !== intervalString) {
                         appLogger.log(`  Dish '${dish.dish_name}': Standardized total_time ${dish.total_time} to ${intervalString}`);
                    }
                } else {
                    appLogger.warn(`  Dish '${dish.dish_name}': Unrecognized total_time string format "${dish.total_time}". Using default ${intervalString}.`);
                }
            } 
            // Handle null or undefined total_time
            else if (dish.total_time === null || dish.total_time === undefined) {
                 appLogger.log(`  Dish '${dish.dish_name}': total_time is null/undefined. Using default ${intervalString}.`);
                 // Keep default intervalString = '00:00:00' or set based on requirements
            } 
            else {
                 appLogger.warn(`  Dish '${dish.dish_name}': Unhandled total_time type "${typeof dish.total_time}" value "${dish.total_time}". Using default ${intervalString}.`);
            }
            // Return dish object with potentially updated total_time
            return { ...dish, total_time: intervalString };
        });
    }
    // Add more preprocessing blocks here for other tables if needed
    // else if (tableName === 'some_other_table') { ... }
    
    // Insert processed data into the table
    const { data: result, error } = await supabase
      .from(tableName)
      .insert(processedData) // Use processedData here
      .select();
    
    if (error) {
      appLogger.error(`Error importing data into ${tableName}:`, JSON.stringify(error, null, 2));
      // Optionally stop execution on error:
      // throw new Error(`Failed to import data into ${tableName}`);
      return;
    }
    
    appLogger.log(`Successfully imported ${result?.length || 0} records into ${tableName}.`);
  } catch (error) {
    appLogger.error(`Error processing ${filePath}:`, error);
    // Optionally re-throw to stop the entire import process
    // throw error;
  }
}

// Main function to import all data
async function importAllData() {
  const inputDir = path.join(__dirname, '../exports');
  
  // Map of file names to table names (Updated)
  const tableMap: Record<string, string> = {
    // Assuming baseUnits was meant to be units?
    'units.json': 'units', 
    // 'userTypes.json': 'user_types', // Assuming removed
    'users.json': 'users', // Keep if users table exists and is needed
    'menuSections.json': 'menu_section',
    'ingredients.json': 'ingredients',
    'preparations.json': 'preparations', // Assumes PK (prep_id) matches ingredients.id
    'dishes.json': 'dishes', // Renamed from recipes.json -> recipe
    'dishComponents.json': 'dish_components', // Renamed from recipeIngredients.json -> recipe_ingredients
    'preparationIngredients.json': 'preparation_ingredients',
    // 'recipePreparations.json': 'recipe_preparations' // Removed
    // Add kitchens and kitchen_users if they exist and need importing
    // 'kitchens.json': 'kitchens',
    // 'kitchenUsers.json': 'kitchen_users',
  };
  
  // Import tables in specific order (respecting foreign key constraints) (Updated)
  // Ensure this order is correct for YOUR specific FKs!
  const importOrder = [
    'units.json', // Units first
    // 'userTypes.json', // Removed
    'users.json', // Users
    // 'kitchens.json', // If adding kitchens
    // 'kitchenUsers.json', // If adding kitchen_users (depends on kitchens/users)
    'menuSections.json', // Menu Sections (might depend on kitchen)
    'ingredients.json', // Ingredients (depends on units)
    'preparations.json', // Preparations (depends on ingredients, units)
    'dishes.json', // Dishes (depends on menu_section, units)
    'dishComponents.json', // Dish Components (depends on dishes, ingredients, units)
    'preparationIngredients.json' // Preparation Ingredients (depends on preparations, ingredients, units)
    // Removed 'recipePreparations.json'
  ];
  
  // Process files in order
  for (const fileName of importOrder) {
    const filePath = path.join(inputDir, fileName);
    const tableName = tableMap[fileName];
    
    if (fs.existsSync(filePath) && tableName) {
      await importTableData(tableName as TableName, filePath);
    } else {
      appLogger.log(`Skipping ${fileName} - file not found or table mapping missing.`);
    }
  }
  
  appLogger.log('Import completed!');
}

// Run the import function
importAllData().catch(error => {
  appLogger.error('Import failed:', error);
  process.exit(1);
}); 