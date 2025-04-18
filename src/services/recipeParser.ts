import { Platform, Alert } from 'react-native';
import { ParsedRecipe } from '../types'; // Import the type for the expected recipe structure

// Type for the expected API response structure (based on parser README)
interface BatchPredictionResponse {
    predictions: {
        recipes: ParsedRecipe[];
        // Include other metadata fields if needed (e.g., validation_success, error)
        validation_success?: boolean;
        processing_success?: boolean;
        error?: string;
        validation_errors?: any;
    }[];
}

export const uploadRecipeImages = async (imageUris: string[]): Promise<ParsedRecipe[]> => {
    const parserUrl = process.env.EXPO_PUBLIC_RECIPE_PARSER_URL;

    if (!parserUrl) {
        console.error('Recipe parser URL is not configured.');
        throw new Error('Recipe parsing service is not configured. Please set EXPO_PUBLIC_RECIPE_PARSER_URL.');
    }

    const formData = new FormData();

    for (const uri of imageUris) {
        // Extract filename from URI (simple approach)
        const filename = uri.split('/').pop() || 'image.jpg';

        // Infer MIME type (basic inference, might need refinement)
        let type = 'image/jpeg'; // Default
        if (filename.endsWith('.png')) {
            type = 'image/png';
        } else if (filename.endsWith('.gif')) {
            type = 'image/gif';
        } // Add more types if needed

        // Append file to FormData
        // Note: React Native FormData handles the URI directly
        formData.append('files', {
            uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
            name: filename,
            type: type,
        } as any); // Cast to any needed for RN FormData file structure
    }

    try {
        console.log(`Uploading ${imageUris.length} image(s) to ${parserUrl}/predict`);
        const response = await fetch(`${parserUrl}/predict`, {
            method: 'POST',
            body: formData,
            headers: {
                // Content-Type is set automatically by fetch for FormData
                // 'Content-Type': 'multipart/form-data', 
            },
        });

        const responseText = await response.text(); // Get text first for debugging
        console.log('Parser Response Status:', response.status);
        console.log('Parser Response Text:', responseText);

        if (!response.ok) {
            throw new Error(`Failed to parse recipe: ${response.status} ${response.statusText} - ${responseText}`);
        }

        const result: BatchPredictionResponse = JSON.parse(responseText);

        // Basic validation of the response structure
        if (!result || !result.predictions || result.predictions.length === 0) {
            throw new Error('Invalid response structure from parser service.');
        }

        const firstPrediction = result.predictions[0];

        // Check for processing/validation errors reported by the parser itself
        if (!firstPrediction.processing_success) {
            throw new Error(`Parser failed processing: ${firstPrediction.error || 'Unknown processing error'}`);
        }
        if (!firstPrediction.validation_success) {
            console.warn('Parser validation errors:', firstPrediction.validation_errors);
            // Decide if validation failure should throw an error or just return potentially incomplete data
            // For now, let's return the recipes but maybe warn the user later
        }

        return firstPrediction.recipes || []; // Return the array of parsed recipes

    } catch (error) {
        console.error('Error uploading/parsing recipe images:', error);
        if (error instanceof Error) {
             throw new Error(`Failed to communicate with recipe parser: ${error.message}`);
        } else {
             throw new Error('An unknown error occurred while parsing the recipe.');
        }
       
    }
}; 