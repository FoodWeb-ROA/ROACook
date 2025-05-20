import { Alert, Platform } from 'react-native';
import { appLogger } from '../services/AppLogService';
import { supabase } from '../data/supabaseClient';
import { TFunction } from 'i18next';

/**
 * Generate an image for a dish or preparation using the BFL API
 * 
 * @param type 'dish' or 'preparation'
 * @param id ID of the dish or preparation
 * @returns Promise resolving to image URL if successful
 */
export const generateRecipeImage = async (
  type: 'dish' | 'preparation',
  id: string
): Promise<string | null> => {
  try {
    // Call the Supabase Edge Function to generate the image
    const functionUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/item-images`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        type,
        id,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (result.success && result.imageUrl) {
      appLogger.log(`Successfully generated image for ${type} ${id}: ${result.imageUrl}`);
      return result.imageUrl;
    } else {
      throw new Error(result.error || 'Unknown error generating image');
    }
  } catch (error: any) {
    appLogger.error(`Failed to generate image for ${type} ${id}:`, error);
    return null;
  }
};

/**
 * Upload a custom image for a dish or preparation
 * 
 * @param type 'dish' or 'preparation'
 * @param id ID of the dish or preparation
 * @param imageUri Local URI of the image to upload
 * @param t Translation function
 * @returns Promise resolving to image URL if successful
 */
export const uploadCustomRecipeImage = async (
  type: 'dish' | 'preparation',
  id: string,
  imageUri: string,
  t: TFunction
): Promise<string | null> => {
  try {
    appLogger.log(`Starting upload for ${type} ${id} from ${imageUri}`);
    
    // Step 1: Get file info
    const fileExt = imageUri.split('.').pop() || 'jpg';
    const fileName = `${type}s/${id}.${fileExt}`;
    const formData = new FormData();
    
    // Different approach based on platform
    if (Platform.OS === 'web') {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      formData.append('file', blob);
    } else {
      // For React Native on mobile platforms
      formData.append('file', {
        uri: imageUri,
        name: fileName,
        type: `image/${fileExt || 'jpeg'}`,
      } as any);
    }
    
    appLogger.log(`Uploading ${fileName} to bucket 'item-images'`);
    
    // Step 2: Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(fileName, formData, {
        cacheControl: '3600',
        upsert: true,
      });
    
    if (uploadError) {
      appLogger.error(`Storage upload error:`, uploadError);
      throw new Error(`Storage upload error: ${uploadError.message}`);
    }
    
    appLogger.log(`Upload successful:`, uploadData);
    
    // Step 3: Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('item-images')
      .getPublicUrl(fileName);
    
    const publicUrl = publicUrlData?.publicUrl;
    
    if (!publicUrl) {
      throw new Error('Failed to get public URL');
    }
    
    appLogger.log(`Public URL generated: ${publicUrl}`);
    
    // Step 4: Update the database with the image URL
    if (type === 'dish') {
      // Direct update for dishes
      const { error: updateError } = await supabase
        .from('dishes')
        .update({ img_url: publicUrl })
        .eq('dish_id', id);
      
      if (updateError) {
        appLogger.error(`Database update error:`, updateError);
        throw new Error(`Database update error: ${updateError.message}`);
      }
    } else {
      // Use Edge Function for preparations
      appLogger.log(`Calling Edge Function to update preparation image URL`);
      const functionUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/item-images`;
      
      const updateResponse = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type,
          id,
          customUrl: publicUrl,
        }),
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        appLogger.error(`Edge function error: ${errorText}`);
        throw new Error(`Error updating database: ${updateResponse.status} ${errorText}`);
      }
      
      appLogger.log(`Preparation image updated successfully via Edge Function`);
    }
    
    appLogger.log(`Upload complete and database updated for ${type} ${id}`);
    
    // Notify user of success
    Alert.alert(
      t('common.success'), 
      t(
        `screens.${type}Detail.imageUploadSuccess`, 
        'Image uploaded successfully'
      )
    );
    
    return publicUrl;
  } catch (error: any) {
    appLogger.error('Image upload error:', error);
    Alert.alert(
      t('common.error'), 
      error?.message || t(
        `screens.${type}Detail.imageUploadFailed`, 
        'Failed to upload image'
      )
    );
    return null;
  }
};
