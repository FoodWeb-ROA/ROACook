#!/bin/bash

# Check if required parameters are provided
if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <supabase-url> <supabase-anon-key>"
  exit 1
fi

# Set environment variables
export EXPO_PUBLIC_SUPABASE_URL="$1"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="$2"

# Print confirmation
echo "Using Supabase URL: $EXPO_PUBLIC_SUPABASE_URL"
echo "Using Supabase Anon Key: $EXPO_PUBLIC_SUPABASE_ANON_KEY"

# Run the export script
npx ts-node scripts/exportData.ts 