import { Client } from '@notionhq/client';
import Constants from 'expo-constants';
import { v4 as uuidv4 } from 'uuid';
import {
	CreatePageParameters,
	CreatePageResponse
} from '@notionhq/client/build/src/api-endpoints';
import { appLogger } from './AppLogService';

// Ensure environment variables are set
const notionApiKey = process.env.EXPO_PUBLIC_NOTION_API_KEY;
const notionDatabaseId = process.env.EXPO_PUBLIC_NOTION_DATABASE_ID;
const notionAppLogsDatabaseId = process.env.EXPO_PUBLIC_NOTION_APP_LOGS_DATABASE_ID;

// Validate configuration
const isNotionConfigured = !!notionApiKey && !!notionDatabaseId;
const isNotionAppLogsConfigured = !!notionAppLogsDatabaseId;

if (!isNotionConfigured) {
	appLogger.warn(
		'Notion integration is not fully configured. Missing API Key or Main Database ID.'
	);
}
if (!isNotionAppLogsConfigured) {
    appLogger.warn(
        'Notion App Logs integration is not fully configured. Missing App Logs Database ID.'
    );
}

const notion = new Client({ auth: notionApiKey });

// --- Interfaces --- //

export interface NotionTicketData {
	title?: string;
	kitchenName: string | null;
	userEmail?: string | null;
	userMessage?: string | null;
	error?: Error | null;
	logContent?: string | null; 
	clientVersion?: string | null;
	logLevel?: 'INFO' | 'WARNING' | 'ERROR' | string | null;
}

// --- Internal Helper Functions --- //

/**
 * Creates a new log entry page in the 'App Log Entries' database.
 */
const createAppLogEntryPage = async (
	ticketId: string, 
	logDetails: string,
	logLevel: string | null
): Promise<string | null> => {
	if (!isNotionConfigured || !isNotionAppLogsConfigured) return null;

	const timestamp = new Date().toISOString();
	const logEntryTitle = `Log - ${ticketId}`;

	try {
		appLogger.log(`Creating Notion App Log entry page: ${logEntryTitle}`);
		const properties: CreatePageParameters['properties'] = {
			'Log Entry': { 
				title: [{ text: { content: logEntryTitle } }]
			},
			'Timestamp': { 
				date: { start: timestamp }
			}
		};

		if (logLevel) {
			properties['Log Level'] = { 
				select: { name: logLevel } 
			};
		}

		const response = await notion.pages.create({
			parent: { database_id: notionAppLogsDatabaseId! },
			properties: properties,
			children: [
				{
					object: 'block' as const,
					type: 'heading_2' as const,
					heading_2: {
						rich_text: [{ type: 'text' as const, text: { content: 'Log Details' } }]
					}
				},
				{
					object: 'block' as const,
					type: 'paragraph' as const,
					paragraph: {
						rich_text: [
							{
								type: 'text' as const,
								text: {
									content: logDetails.substring(0, 2000)
								}
							}
						]
					}
				}
			]
		});
		appLogger.log(`Successfully created App Log entry page with ID: ${response.id}`);
		return response.id;
	} catch (error: any) {
		appLogger.error(
			'Failed to create Notion App Log entry page:',
			error.body || error.message || error
		);
		return null;
	}
};

/**
 * Creates the main ticket entry in the 'Support Tickets and Errors' database.
 * Links to an App Log Entry page if appLogPageId is provided.
 */
const createNotionTicketEntry = async (
	ticketId: string,
	data: NotionTicketData,
	appLogPageId: string | null 
): Promise<CreatePageResponse | null> => {
	if (!isNotionConfigured) return null;

	const timestamp = new Date().toISOString();
	const clientVersion = data.clientVersion ?? Constants.expoConfig?.version ?? 'unknown';
	try {
		appLogger.log(`Creating Notion support ticket entry: ${ticketId}`);
		const properties: CreatePageParameters['properties'] = {
			Title: {
				title: [{ text: { content: data.title || 'Auto Report' } }]
			},
			Timestamp: {
				date: { start: timestamp }
			},
			'Kitchen Name': {
				rich_text: [{ text: { content: data.kitchenName ?? 'N/A' } }]
			},
			'User Email': {
				email: data.userEmail || null
			},
			'User Message': {
				rich_text: [
					{
						text: {
							content:
								data.userMessage ?? data.error?.message ?? 'No message'
						}
					}
				]
			},
			'Client Version': {
				rich_text: [{ text: { content: clientVersion } }]
			}
		};

		if (appLogPageId && isNotionAppLogsConfigured) {
			properties['Log Entry'] = { 
				relation: [{ id: appLogPageId }]
			};
		}

		const ticketResponse = await notion.pages.create({
			parent: { database_id: notionDatabaseId! },
			properties: properties
		});
		appLogger.log(`Successfully created ticket entry with ID: ${ticketResponse.id}`);
		return ticketResponse;
	} catch (error: any) {
		appLogger.error(
			'Failed to create Notion ticket entry:',
			error.body || error.message || error
		);
		return null;
	}
};

// --- Exported Function (Combined Logic) --- //

/**
 * Creates a support ticket in Notion and a related log entry in a separate 'App Log Entries' database.
 * This is the main function to call from outside.
 */
export const reportToNotion = async (data: NotionTicketData): Promise<boolean> => {
	if (!isNotionConfigured) {
		appLogger.warn('[reportToNotion] Notion (main) not configured, skipping report.');
		return false;
	}

	const ticketId = uuidv4();
	const logDetails = data.logContent ?? data.error?.stack ?? null;
	const logLevel = data.logLevel ?? (data.error ? 'ERROR' : 'INFO');
	let appLogPageId: string | null = null;

	// Diagnostic logging
	appLogger.log(`[reportToNotion] Ticket ID generated: ${ticketId}`);
	appLogger.log(`[reportToNotion] Log details exist: ${logDetails ? 'Yes' : 'No'}`);
	if(logDetails) {
		appLogger.log(`[reportToNotion] Log details preview (first 50 chars): ${logDetails.substring(0,50)}`);
	}
	appLogger.log(`[reportToNotion] Log level: ${logLevel}`);
	appLogger.log(`[reportToNotion] Is Notion App Logs Configured (isNotionAppLogsConfigured var): ${isNotionAppLogsConfigured}`);
	appLogger.log(`[reportToNotion] Raw EXPO_PUBLIC_NOTION_APP_LOGS_DATABASE_ID from env: ${process.env.EXPO_PUBLIC_NOTION_APP_LOGS_DATABASE_ID}`);

	// 1. Create the log page in 'App Log Entries' database if logDetails exist
	if (logDetails && isNotionAppLogsConfigured) {
		appLogger.log('[reportToNotion] Attempting to create app log entry page...');
		appLogPageId = await createAppLogEntryPage(ticketId, logDetails, logLevel);
		appLogger.log(`[reportToNotion] App log page ID creation attempt finished. Resulting ID: ${appLogPageId}`);
	} else if (logDetails && !isNotionAppLogsConfigured) {
        appLogger.warn('[reportToNotion] Log details exist but Notion App Logs DB is not configured. Skipping log entry creation.');
    } else if (!logDetails) {
        appLogger.log('[reportToNotion] No log details provided. Skipping log entry creation.');
    }

	// 2. Create the main ticket entry, linking to the app log page if created
	appLogger.log(`[reportToNotion] Proceeding to create main ticket entry. AppLogPageId to link: ${appLogPageId}`);
	const ticketResponse = await createNotionTicketEntry(ticketId, data, appLogPageId);

	// Return true if the main ticket entry was successfully created
	appLogger.log(`[reportToNotion] Main ticket creation attempt finished. Success: ${!!ticketResponse}`);
	return !!ticketResponse;
}; 