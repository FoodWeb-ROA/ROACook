import fs from 'fs';
import path from 'path';
import { fetchAllData, fetchRecipesWithRelatedData } from '../src/data/fetchDatabase';

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '../exports');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function exportData() {
  try {
    console.log('Fetching all database data...');
    
    // Fetch all data
    const allData = await fetchAllData();
    
    // Write each table to its own file
    Object.entries(allData).forEach(([tableName, data]) => {
      const filePath = path.join(outputDir, `${tableName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Exported ${tableName} to ${filePath}`);
    });
    
    // Export all data to a single file
    const allDataPath = path.join(outputDir, 'all-data.json');
    fs.writeFileSync(allDataPath, JSON.stringify(allData, null, 2));
    console.log(`Exported complete database to ${allDataPath}`);
    
    // Fetch and export recipes with related data
    console.log('Fetching recipes with related data...');
    const recipesWithData = await fetchRecipesWithRelatedData();
    const recipesPath = path.join(outputDir, 'recipes-with-related-data.json');
    fs.writeFileSync(recipesPath, JSON.stringify(recipesWithData, null, 2));
    console.log(`Exported recipes with related data to ${recipesPath}`);
    
    console.log('Data export completed successfully!');
  } catch (error) {
    console.error('Error exporting data:', error);
    process.exit(1);
  }
}

// Run the export
exportData(); 