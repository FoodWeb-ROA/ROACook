// Central definitions for the special "Preparation" pseudo-unit used throughout the app.
// Having these in one place avoids hard-coding values across the codebase and
// simplifies future migrations.

/**
 * UUID for the dedicated "Preparation" unit row created by the database
 * migration. All dish/preparation components that reference another
 * preparation should use this ID in their `unit_id` column.
 */
export const PREPARATION_UNIT_ID = '13bcd39d-c167-4edc-902e-6b61443e7986';

/**
 * Abbreviation shown to users. We display it as a simple multiplier (e.g. ×1.5).
 * Keep this lower-case to simplify look-ups/comparisons.
 */
export const PREPARATION_UNIT_ABBR = 'prep';
