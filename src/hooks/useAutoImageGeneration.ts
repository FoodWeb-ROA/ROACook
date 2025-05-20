import { useState, useEffect } from 'react';
import { generateRecipeImage } from '../utils/imageUtils';
import { appLogger } from '../services/AppLogService';

/**
 * Hook to automatically generate an image for a newly created dish or preparation
 * 
 * @param type 'dish' or 'preparation'
 * @param id ID of the dish or preparation
 * @param isNewlyCreated Flag indicating if this is a new item that needs an image
 * @returns Object with image URL and loading state
 */
export const useAutoImageGeneration = (
  type: 'dish' | 'preparation',
  id: string | null,
  isNewlyCreated: boolean
): { imageUrl: string | null; isGenerating: boolean } => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Generate an image automatically when a new dish/preparation is created
  useEffect(() => {
    // Only generate if we have an ID and this is a newly created item
    if (id && isNewlyCreated) {
      const generateImage = async () => {
        try {
          setIsGenerating(true);
          appLogger.log(`Automatically generating image for new ${type} (${id})`);
          
          // Call the image generation utility
          const generatedUrl = await generateRecipeImage(type, id);
          
          if (generatedUrl) {
            setImageUrl(generatedUrl);
            appLogger.log(`Successfully generated image for ${type} (${id}): ${generatedUrl}`);
          } else {
            appLogger.warn(`Failed to generate image for ${type} (${id})`);
          }
        } catch (error) {
          appLogger.error(`Error generating image for ${type} (${id}):`, error);
        } finally {
          setIsGenerating(false);
        }
      };
      
      generateImage();
    }
  }, [type, id, isNewlyCreated]);

  return { imageUrl, isGenerating };
};
