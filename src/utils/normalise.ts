'use strict';

import { ComponentInput } from '../types'; // Assuming ComponentInput is defined here

/**
 * Normalizes a string by converting to lowercase, trimming, and collapsing whitespace.
 */
export function slug(s: string): string {
  if (!s) return '';
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Strips directions text by removing punctuation, numbers, converting to lowercase,
 * joining lines, and trimming.
 */
export function stripDirections(text: string | string[] | null | undefined): string {
  if (!text) return '';
  const combinedText = Array.isArray(text) ? text.join(' ') : text;
  return combinedText
    .toLowerCase()
    .replace(/[.,;:!?()"'\d\.]/g, '') // Remove punctuation and digits
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Generates a fingerprint for a preparation based on its normalized ingredients and directions.
 *
 * NOTE: This is a placeholder using a simple join. For production, a cryptographic hash
 * (like SHA-1 or MD5 if crypto is available and suitable) on the sorted, normalized data
 * would be more robust against reordering and minor variations.
 *
 * We will sort components by name primarily, and ingredient_id secondarily if names match,
 * to ensure consistent ordering.
 */
export function fingerprintPreparation(
  components: ComponentInput[],
  directions: string[] | string | null | undefined
): string {
  // 1. Normalize and sort components
  const sortedNormalizedComponents = components
    .slice() // Create a shallow copy to avoid mutating the original array
    .sort((a, b) => {
      const nameA = slug(a.name);
      const nameB = slug(b.name);
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      // If names are the same, sort by ingredient_id (if available) as a tie-breaker
      const idA = a.ingredient_id || '';
      const idB = b.ingredient_id || '';
      if (idA < idB) return -1;
      if (idA > idB) return 1;
      return 0;
    })
    .map(c => `${slug(c.name)}:${c.amount}:${c.unit_id || 'null'}`) // Normalize relevant fields
    .join('|'); // Join components with a delimiter

  // 2. Normalize directions
  const normalizedDirections = stripDirections(directions);

  // 3. Combine and return (placeholder - ideally hash this combined string)
  const combined = `${sortedNormalizedComponents}::${normalizedDirections}`;

  // In a real-world scenario, you'd hash 'combined' here.
  // For now, we return the combined string itself as a basic fingerprint.
  // Example (if crypto available):
  // import crypto from 'crypto'; // Or appropriate import for RN
  // return crypto.createHash('sha1').update(combined).digest('hex');

  return combined; // Placeholder return
} 