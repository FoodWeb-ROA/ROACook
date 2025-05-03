// Get Notion API keys from environment variables
// Will inject safely in production
const NOTION_API_KEY = process.env.EXPO_PUBLIC_NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.EXPO_PUBLIC_NOTION_DATABASE_ID;

// Notion API endpoints
const NOTION_API_ENDPOINT = 'https://api.notion.com/v1/pages';
const NOTION_API_VERSION = '2022-06-28';

/**
 * Submit data to Notion database
 * Used for both feedback and error reports
 */
export const submitToNotion = async (data: Record<string, any>): Promise<boolean> => {
  try {
    // Check for API key and database ID
    if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
      console.error('Notion API key or database ID is missing');
      return false;
    }

    const currentTimestamp = new Date().toISOString();
    
    // Prepare the request body based on data properties
    const requestBody: any = {
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        // Common title field (required by Notion)
        'Title': {
          title: [
            {
              type: 'text',
              text: {
                content: data.title || (data.isError ? 'Error Report' : 'User Feedback'),
              },
            },
          ],
        },
        // Timestamp field
        'Timestamp': {
          date: {
            start: currentTimestamp,
          },
        },
      },
    };
    
    // Add properties based on whether it's feedback or error report
    if (data.isError) {
      // Error report specific properties
      requestBody.properties['Error Message'] = {
        rich_text: [
          {
            type: 'text',
            text: {
              content: data.errorMessage || 'No error message provided',
            },
          },
        ],
      };
      
      requestBody.properties['Component'] = {
        rich_text: [
          {
            type: 'text',
            text: {
              content: data.componentName || 'Unknown component',
            },
          },
        ],
      };
      
      requestBody.properties['Error Type'] = {
        select: {
          name: data.severity || 'Medium',
        },
      };
      
      // Stack trace in content
      if (data.errorStack) {
        requestBody.children = [
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Stack Trace' } }]
            }
          },
          {
            object: 'block',
            type: 'code',
            code: {
              rich_text: [{ type: 'text', text: { content: data.errorStack } }],
              language: 'javascript'
            }
          }
        ];
        
        // Additional info block if provided
        if (data.additionalInfo) {
          requestBody.children.push(
            {
              object: 'block',
              type: 'heading_2',
              heading_2: {
                rich_text: [{ type: 'text', text: { content: 'Additional Information' } }]
              }
            },
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: data.additionalInfo } }]
              }
            }
          );
        }
      }
    } else {
      // Feedback specific properties
      requestBody.properties['Feedback'] = {
        rich_text: [
          {
            type: 'text',
            text: {
              content: data.feedbackText || 'No feedback provided',
            },
          },
        ],
      };
    }
    
    // Common properties
    if (data.userId) {
      requestBody.properties['User ID'] = {
        rich_text: [
          {
            type: 'text',
            text: {
              content: data.userId,
            },
          },
        ],
      };
    }
    
    if (data.kitchenName) {
      requestBody.properties['Kitchen Name'] = {
        rich_text: [
          {
            type: 'text',
            text: {
              content: data.kitchenName,
            },
          },
        ],
      };
    }
    
    // Type property to distinguish between feedback and errors
    requestBody.properties['Type'] = {
      select: {
        name: data.isError ? 'Error' : 'Feedback',
      },
    };

    // Make the API call
    const response = await fetch(NOTION_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Notion API Error:', errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error submitting to Notion:', error);
    return false;
  }
}; 