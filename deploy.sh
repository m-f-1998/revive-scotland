#!/bin/bash

set -e

# Get the directory of the script to handle relative paths correctly
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Optional local deploy secrets (CR_PAT, Portainer webhooks). Not used by the app server.
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
  set +a
fi

USERNAME="m-f-1998"
REPO_NAME="revive-scotland"
MODE="${1:-local}"

if [[ "$MODE" == "latest" ]]; then
  TAG="latest"
  echo "🚀 Building for PRODUCTION (tag: $TAG)"
elif [[ "$MODE" == "dev" ]]; then
  TAG="dev"
  echo "🧪 Building for DEVELOPMENT (tag: $TAG)"
else
  echo "❌ Invalid mode specified. Use 'latest' or 'dev'."
  exit 1
fi

if [ -z "$CR_PAT" ]; then
  echo "❌ CR_PAT (GitHub Container Registry Personal Access Token) not provided."
  echo "Example: CR_PAT=your_token_here ./deploy.sh dev"
  exit 1
fi

IMAGE="ghcr.io/$USERNAME/$REPO_NAME:$TAG"

echo "📦 Compiling project..."
"$SCRIPT_DIR/docker/compile.sh"

if ! docker buildx inspect multiarch > /dev/null 2>&1; then
  echo "🔧 Creating new buildx builder..."
  docker buildx create --name multiarch --use
fi

if ! docker info 2>/dev/null | grep -q 'ghcr.io'; then
  echo "🔐 Logging into GitHub Container Registry..."
  echo $CR_PAT | docker login ghcr.io -u $USERNAME --password-stdin
else
  echo "🔓 Already logged into GitHub Container Registry."
fi

echo "🐳 Building and Pushing Multi-Arch Docker image: $IMAGE"
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/Dockerfile \
  -t $IMAGE \
  --push .

echo "✅ Success! Image pushed to: $IMAGE"

if [[ "$TAG" == "latest" && -n "$PORTAINER_WEBHOOK_LATEST" ]]; then
  PORTAINER_WEBHOOK="$PORTAINER_WEBHOOK_LATEST"
elif [[ "$TAG" == "dev" && -n "$PORTAINER_WEBHOOK_DEV" ]]; then
  PORTAINER_WEBHOOK="$PORTAINER_WEBHOOK_DEV"
fi

if [[ -n "$PORTAINER_WEBHOOK" ]]; then
  echo "🔄 Triggering Portainer redeploy for tag: $TAG"
  HTTP_STATUS=$(curl -s -o /tmp/portainer-webhook.out -w "%{http_code}" -X POST "$PORTAINER_WEBHOOK")
  if [[ "$HTTP_STATUS" == "204" || "$HTTP_STATUS" == "200" ]]; then
    echo "✅ Portainer redeploy triggered."
  else
    echo "⚠️  Portainer webhook returned HTTP $HTTP_STATUS:"
    cat /tmp/portainer-webhook.out
    exit 1
  fi
else
  echo "ℹ️  No Portainer webhook configured for tag '$TAG' (set PORTAINER_WEBHOOK_LATEST or PORTAINER_WEBHOOK_DEV)."
fi