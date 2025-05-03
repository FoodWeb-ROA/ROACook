import { Client } from '@notionhq/client';
import Constants from 'expo-constants';
import { v4 as uuidv4 } from 'uuid';
import {
	CreatePageParameters,
	CreatePageResponse
} from '@notionhq/client/build/src/api-endpoints';

// Ensure environment variables are set
const notionApiKey = process.env.EXPO_PUBLIC_NOTION_API_KEY;
const notionDatabaseId = process.env.EXPO_PUBLIC_NOTION_DATABASE_ID;

// Validate configuration
const isNotionConfigured = !!notionApiKey && !!notionDatabaseId;

if (!isNotionConfigured) {
	console.warn(
		'Notion integration is not fully configured. Missing API Key or Database ID.'
	);
}

const notion = new Client({ auth: notionApiKey });

// --- Interfaces --- //

export interface NotionTicketData {
	kitchenName: string | null;
	userName: string | null;
	userMessage?: string | null;
	error?: Error | null;
	logContent?: string | null; // Can be error stack or other logs
	clientVersion?: string | null;
}

// --- Internal Helper Functions --- //

/**
 * Creates a Notion page (typically used for logs).
 * Assumes the parent is the main database unless overridden.
 */
const createNotionLogPage = async (
	title: string,
	content: string,
	parentDbId: string = notionDatabaseId! // Default to main DB ID
): Promise<CreatePageResponse | null> => {
	if (!isNotionConfigured) return null;

	try {
		console.log(`Creating Notion log page: ${title}`);
		const response = await notion.pages.create({
			parent: { database_id: parentDbId },
			// Assumes the log page just needs a Title property in the database
			properties: {
				Title: {
					title: [{ text: { content: title } }]
				}
			},
			// Add content as blocks
			children: [
				{
					object: 'block',
					type: 'heading_2',
					heading_2: {
						rich_text: [{ type: 'text', text: { content: 'Details' } }]
					}
				},
				{
					object: 'block',
					type: 'paragraph',
					paragraph: {
						rich_text: [
							{
								type: 'text',
								text: {
									// Limit content length
									content: content.substring(0, 2000)
								}
							}
						]
					}
				}
			]
		});
		console.log(`Successfully created log page with ID: ${response.id}`);
		return response;
	} catch (error: any) {
		console.error(
			'Failed to create Notion log page:',
			error.body || error.message || error
		);
		return null;
	}
};

/**
 * Creates the main ticket entry in the Notion database.
 */
const createNotionTicketEntry = async (
	ticketId: string,
	data: NotionTicketData,
	logPageId: string | null
): Promise<CreatePageResponse | null> => {
	if (!isNotionConfigured) return null;

	const timestamp = new Date().toISOString();
	const clientVersion = data.clientVersion ?? Constants.expoConfig?.version ?? 'unknown';
	try {
		console.log(`Creating Notion support ticket entry: ${ticketId}`);
		const properties: CreatePageParameters['properties'] = {
			// Adjust property names EXACTLY as they appear in Notion
			Title: {
				title: [{ text: { content: ticketId } }]
			},
			Timestamp: {
				date: { start: timestamp }
			},
			'kitchen name': {
				rich_text: [{ text: { content: data.kitchenName ?? 'N/A' } }]
			},
			'user name': {
				rich_text: [{ text: { content: data.userName ?? 'N/A' } }]
			},
			'user message': {
				rich_text: [
					{
						text: {
							content:
								data.userMessage ?? data.error?.message ?? 'No message'
						}
					}
				]
			},
			'client build version': {
				rich_text: [{ text: { content: clientVersion } }]
			}
		};

		// Add relation only if logPageId is valid
		if (logPageId) {
			properties['log entry'] = {
				// Assumes relation property named 'log entry'
				relation: [{ id: logPageId }]
			};
		}

		const response = await notion.pages.create({
			parent: { database_id: notionDatabaseId! },
			properties: properties
		});
		console.log(`Successfully created ticket entry with ID: ${response.id}`);
		return response;
	} catch (error: any) {
		console.error(
			'Failed to create Notion ticket entry:',
			error.body || error.message || error
		);
		return null;
	}
};

// --- Exported Function (Combined Logic) --- //

/**
 * Creates a support ticket in Notion, including a related page for logs.
 * This is the main function to call from outside.
 */
export const reportToNotion = async (data: NotionTicketData): Promise<boolean> => {
	if (!isNotionConfigured) {
		console.warn('Notion not configured, skipping report.');
		return false;
	}

	const ticketId = uuidv4();
	const logTitle = `Log - ${ticketId}`;
	// Prioritize specific logContent, fallback to error stack
	const logDetails = data.logContent ?? data.error?.stack ?? 'No detailed logs provided.';
	let logPageId: string | null = null;

	// 1. Create the log page
	const logPageResponse = await createNotionLogPage(logTitle, logDetails);
	if (logPageResponse) {
		logPageId = logPageResponse.id;
	}

	// 2. Create the main ticket entry, linking to the log page if created
	const ticketResponse = await createNotionTicketEntry(ticketId, data, logPageId);

	// Return true if the main ticket entry was successfully created
	return !!ticketResponse;
}; 