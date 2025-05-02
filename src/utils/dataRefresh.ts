import { queryClient } from '../data/queryClient';

/**
 * Utility function to refresh dish data after CRUD operations.
 * This invalidates the relevant query cache which triggers a refetch.
 * 
 * @param kitchenId - The current kitchen ID
 * @param type - The type of data to refresh (dishes, ingredients, preparations, etc.)
 */
export const refreshData = (kitchenId: string | null, type: 'dishes' | 'ingredients' | 'preparations' | 'menu_section' = 'dishes') => {
  if (!kitchenId) {
    console.warn('Cannot refresh data: No kitchen ID provided');
    return;
  }

  console.log(`Refreshing ${type} data for kitchen: ${kitchenId}`);
  
  // Invalidate the main query
  queryClient.invalidateQueries({ queryKey: [type, { kitchen_id: kitchenId }] });
  
  // Invalidate related queries based on type
  switch (type) {
    case 'dishes':
      // If we modify dishes, we should also refresh menu sections
      queryClient.invalidateQueries({ queryKey: ['menu_section'] });
      break;
    case 'ingredients':
      // Ingredients might affect preparations and dishes
      queryClient.invalidateQueries({ queryKey: ['preparations'] });
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      break;
    case 'preparations':
      // Preparations might affect ingredients and dishes
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      break;
    case 'menu_section':
      // Menu sections affect dishes
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      break;
  }
}; 