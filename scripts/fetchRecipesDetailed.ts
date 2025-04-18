import fs from 'fs';
import path from 'path';
import { supabase } from '../src/data/supabaseClient';
import { fetchDishesWithRelatedData } from '../src/data/fetchDatabase';

/**
 * Fetches detailed dish data using the refactored fetch function 
 * and saves it to a JSON file.
 */
async function fetchDetailedDishes() {
  try {
    console.log('Fetching detailed dish data using centralized function...');
    
    // Use the already refactored function from fetchDatabase
    const detailedDishes = await fetchDishesWithRelatedData();
    
    if (!detailedDishes) {
        console.log('No detailed dishes found.');
        return;
    }

    console.log(`Fetched ${detailedDishes.length} detailed dishes.`);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save to file
    const filePath = path.join(outputDir, 'detailed-dishes.json');
    fs.writeFileSync(filePath, JSON.stringify(detailedDishes, null, 2));
    
    console.log(`Exported ${detailedDishes.length} detailed dishes to ${filePath}`);
    
  } catch (error) {
    console.error('Error fetching detailed dishes:', error);
    throw error;
  }
}

// Run the function
fetchDetailedDishes().catch(error => {
  console.error('Failed to fetch detailed dishes:', error);
  process.exit(1);
}); 