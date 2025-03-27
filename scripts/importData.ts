import fs from 'fs';
import path from 'path';
import { supabase } from '../src/data/supabaseClient';

// This function will import data from a JSON file into a Supabase table
async function importTableData(tableName: string, filePath: string) {
  try {
    // Read the JSON file
    const fileData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileData);
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`No data found in ${filePath} or data is not an array.`);
      return;
    }
    
    console.log(`Importing ${data.length} records into ${tableName}...`);
    
    // Insert data into the table
    const { data: result, error } = await supabase
      .from(tableName)
      .insert(data)
      .select();
    
    if (error) {
      console.error(`Error importing data into ${tableName}:`, error);
      return;
    }
    
    console.log(`Successfully imported ${result?.length || 0} records into ${tableName}.`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Main function to import all data
async function importAllData() {
  // Use the directory containing JSON files
  const inputDir = path.join(__dirname, '../exports');
  
  // Map of file names to table names
  const tableMap: Record<string, string> = {
    'baseUnits.json': 'base_units',
    'userTypes.json': 'user_types',
    'users.json': 'users',
    'menuSections.json': 'menu_section',
    'ingredients.json': 'ingredients',
    'preparations.json': 'preparations',
    'recipes.json': 'recipe',
    'recipeIngredients.json': 'recipe_ingredients',
    'preparationIngredients.json': 'preparation_ingredients',
    'recipePreparations.json': 'recipe_preparations'
  };
  
  // Import tables in specific order (respecting foreign key constraints)
  const importOrder = [
    'baseUnits.json',
    'userTypes.json', 
    'users.json',
    'menuSections.json',
    'ingredients.json',
    'preparations.json',
    'recipes.json',
    'recipeIngredients.json',
    'preparationIngredients.json',
    'recipePreparations.json'
  ];
  
  // Process files in order
  for (const fileName of importOrder) {
    const filePath = path.join(inputDir, fileName);
    const tableName = tableMap[fileName];
    
    if (fs.existsSync(filePath) && tableName) {
      await importTableData(tableName, filePath);
    } else {
      console.log(`Skipping ${fileName} - file not found or table mapping missing.`);
    }
  }
  
  console.log('Import completed!');
}

// Run the import function
importAllData().catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
}); 