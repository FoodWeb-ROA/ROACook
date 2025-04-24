#!/bin/bash
# Extract GCS credentials from image-store-gcs-key and set up in Google Cloud Secret Manager

# Path to the image-store-gcs-key file
KEY_FILE="scripts/image-store-gcs-key.json"

if [ ! -f "$KEY_FILE" ]; then
  echo "Error: image-store-gcs-key file not found at $KEY_FILE"
  exit 1
fi

# Extract the client email from the key file
CLIENT_EMAIL=$(grep -o '"client_email": "[^"]*' "$KEY_FILE" | cut -d'"' -f4)
echo "Extracted client email: $CLIENT_EMAIL"

# Extract the private key from the key file and save to a temporary file
PRIVATE_KEY=$(grep -o '"private_key": "[^"]*' "$KEY_FILE" | cut -d'"' -f4)
echo "Extracted private key"
echo "$PRIVATE_KEY" > gcs-private-key.txt

# Set the project ID
PROJECT_ID="imperial-rarity-442220-c9"
echo "Using project ID: $PROJECT_ID"

# Prompt for confirmation
read -p "Do you want to create the secrets in Google Cloud Secret Manager? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Operation canceled."
  rm gcs-private-key.txt
  exit 0
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
  echo "Error: gcloud CLI is not installed. Please install it first:"
  echo "https://cloud.google.com/sdk/docs/install"
  rm gcs-private-key.txt
  exit 1
fi

# Create the secrets in Secret Manager
echo "Creating secrets in Google Cloud Secret Manager..."

# Set the project
gcloud config set project "$PROJECT_ID"

# Create the email secret
echo "$CLIENT_EMAIL" | gcloud secrets create user-recipe-image-worker-email --data-file=-
if [ $? -ne 0 ]; then
  echo "Error: Failed to create email secret"
  rm gcs-private-key.txt
  exit 1
fi

# Create the private key secret
gcloud secrets create user-recipe-image-worker-key --data-file=gcs-private-key.txt
if [ $? -ne 0 ]; then
  echo "Error: Failed to create private key secret"
  rm gcs-private-key.txt
  exit 1
fi

# Clean up
rm gcs-private-key.txt

echo "Success! GCS credentials have been stored in Google Cloud Secret Manager."
echo "Next steps:"
echo "1. Grant access to the appropriate service accounts:"
echo "   gcloud secrets add-iam-policy-binding user-recipe-image-worker-email --member=\"serviceAccount:YOUR_SERVICE_ACCOUNT\" --role=\"roles/secretmanager.secretAccessor\""
echo "   gcloud secrets add-iam-policy-binding user-recipe-image-worker-key --member=\"serviceAccount:YOUR_SERVICE_ACCOUNT\" --role=\"roles/secretmanager.secretAccessor\""
echo "2. Update your Supabase Edge Functions to use the secrets" 