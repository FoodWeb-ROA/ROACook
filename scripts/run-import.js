/**
 * Script to run the data import with supplied Supabase credentials
 * Usage: node scripts/run-import.js <supabase-url> <supabase-anon-key>
 */

const { spawn } = require('child_process');
const path = require('path');

// Check if we have the necessary arguments
if (process.argv.length < 4) {
  console.error('Usage: node scripts/run-import.js <supabase-url> <supabase-anon-key>');
  process.exit(1);
}

// Get Supabase credentials from command line arguments
const supabaseUrl = process.argv[2];
const supabaseKey = process.argv[3];

console.log(`Using Supabase URL: ${supabaseUrl}`);
console.log(`Using Supabase Anon Key: ${supabaseKey}`);

// Set environment variables and run the import script
const env = {
  ...process.env,
  EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: supabaseKey
};

// Run the import script using ts-node
const tsNode = spawn('npx', ['ts-node', path.join(__dirname, 'importData.ts')], {
  env,
  stdio: 'inherit'
});

tsNode.on('close', (code) => {
  if (code !== 0) {
    console.error(`Import script exited with code ${code}`);
    process.exit(code);
  }
}); 