import fs from 'fs';
import path from 'path';
import { fetchAllData, fetchDishesWithRelatedData } from '../src/data/fetchDatabase';

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '../exports');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function exportData() {
  try {
    console.log('Fetching all relevant database data...');
    
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
    console.log(`Exported complete relevant database tables to ${allDataPath}`);
    
    // Fetch and export dishes with related data
    console.log('Fetching dishes with related data...');
    const dishesWithData = await fetchDishesWithRelatedData();
    const dishesPath = path.join(outputDir, 'dishes-with-related-data.json');
    fs.writeFileSync(dishesPath, JSON.stringify(dishesWithData, null, 2));
    console.log(`Exported dishes with related data to ${dishesPath}`);
    
    console.log('Data export completed successfully!');
  } catch (error) {
    console.error('Error exporting data:', error);
    process.exit(1);
  }
}

// Run the export
exportData(); 