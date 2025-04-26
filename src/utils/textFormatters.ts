/**
 * Text formatting utility functions for consistent display across the app
 */

/**
 * Capitalizes the first letter of each word in a string
 * 
 * @param text The text to be capitalized
 * @param preserveSmallWords Whether to keep small connecting words (a, an, the, etc.) lowercase
 * @returns Properly capitalized text
 */
export const capitalizeWords = (text?: string, preserveSmallWords = false): string => {
  if (!text) return '';
  
  const trimmedText = text.trim();
  if (!trimmedText) return '';
  
  const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'up', 'yet']);
  
  return trimmedText.split(' ').map((word, index) => {
    if (word.length === 0) return '';
    
    if (index === 0 || !preserveSmallWords || !smallWords.has(word.toLowerCase())) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    
    return word.toLowerCase();
  }).join(' ');
};

/**
 * Formats measurement quantities to remove trailing zeros
 * 
 * @param value The numeric value to format
 * @returns Formatted number as string
 */
export const formatQuantity = (value?: number | string): string => {
  if (value === undefined || value === null) return '';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '';
  
  // Always format to one decimal place
  return numValue.toFixed(1);
};

/**
 * Formats a quantity and automatically adjusts the unit for readability.
 * (e.g., 1500g -> 1.5 kg, 2500ml -> 2.5 l)
 *
 * @param quantity The numeric quantity.
 * @param unitAbbr The original unit abbreviation (e.g., 'g', 'ml', 'oz', 'x').
 * @param item Optional item descriptor (e.g., 'cloves' when unit is 'x').
 * @returns An object { amount: string; unit: string } with the formatted amount and adjusted unit.
 */
export const formatQuantityAuto = (
  quantity: number | null | undefined,
  unitAbbr: string | null | undefined,
  item?: string | null | undefined
): { amount: string; unit: string } => {
  if (quantity === null || quantity === undefined) {
    return { amount: 'N/A', unit: item || '' }; // Return item if unit is missing but item exists
  }

  let adjustedQuantity = quantity;
  let adjustedUnit = unitAbbr;
  const lowerUnitAbbr = unitAbbr?.toLowerCase(); // Convert to lowercase for comparisons

  // Special handling for counts ('x') with an item
  if (lowerUnitAbbr === 'x' && item) {
    let pluralizedItem = item;
    // Simple pluralization: add 's' if quantity is not 1 and item doesn't end in 's'
    if (quantity !== 1 && !item.toLowerCase().endsWith('s')) {
        pluralizedItem = item + 's';
    } else if (quantity !== 1 && item.toLowerCase().endsWith('ss')) {
        // Handle words ending in 'ss' -> 'sses' (e.g., glass -> glasses)
        pluralizedItem = item + 'es';
    }
    adjustedUnit = pluralizedItem; // Use (potentially pluralized) item as the unit description
  }

  const thresholds: Record<string, { limit: number; newUnit: string }> = {
    g: { limit: 1000, newUnit: 'kg' },
    ml: { limit: 1000, newUnit: 'l' },
    oz: { limit: 16, newUnit: 'lb' },
    // Add more conversions as needed (e.g., tsp -> tbsp -> cup)
  };

  const inverseThresholds: Record<string, { limit: number; newUnit: string }> = {
      kg: { limit: 1, newUnit: 'g' },
      l: { limit: 1, newUnit: 'ml' },
      lb: { limit: 1, newUnit: 'oz' },
  };

  const epsilon = 1e-9; // Small value for float comparisons

  // Scale Up (e.g., g to kg)
  if (lowerUnitAbbr && thresholds[lowerUnitAbbr] && quantity >= thresholds[lowerUnitAbbr].limit - epsilon) {
    adjustedQuantity = quantity / thresholds[lowerUnitAbbr].limit;
    adjustedUnit = thresholds[lowerUnitAbbr].newUnit;
  } 
  // Scale Down (e.g., 0.5 kg to 500 g)
  else if (lowerUnitAbbr && inverseThresholds[lowerUnitAbbr] && quantity < inverseThresholds[lowerUnitAbbr].limit - epsilon) {
      // Use the conversion factor from the base unit threshold (e.g., 1000 for g from kg)
      const baseUnit = inverseThresholds[lowerUnitAbbr].newUnit;
      // Use lowercase base unit for lookup in thresholds
      const conversionFactor = thresholds[baseUnit.toLowerCase()]?.limit; 
      if (conversionFactor) {
          adjustedQuantity = quantity * conversionFactor;
          adjustedUnit = inverseThresholds[lowerUnitAbbr].newUnit;
      }
  }

  return {
    amount: formatQuantity(adjustedQuantity), // Use existing formatter for decimals
    unit: adjustedUnit || '', // Ensure unit is always a string
  };
}; 