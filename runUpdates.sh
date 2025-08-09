#!/bin/bash

echo "🔄 Updating client packages..."
cd client
npm update --save

OUTDATED=$(npm outdated --json || echo "")
if [[ "$OUTDATED" != "{}" && -n "$OUTDATED" ]]; then
  echo "⚠️ Some packages have major updates and need to be checked manually."
  echo "$OUTDATED" | jq '.'  # pretty print JSON, requires jq installed on runner or you can just echo raw
else
  echo "✅ No major updates found in server."
fi

echo ""
echo "🔄 Updating server packages..."
cd ../server
npm update --save

OUTDATED=$(npm outdated --json || echo "")
if [[ "$OUTDATED" != "{}" && -n "$OUTDATED" ]]; then
  echo "⚠️ Some packages have major updates and need to be checked manually."
  echo "$OUTDATED" | jq '.'  # pretty print JSON, requires jq installed on runner or you can just echo raw
else
  echo "✅ No major updates found in server."
fi

echo ""
read -p "Press any key to exit..." -n1 -s