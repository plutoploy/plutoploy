#!/bin/bash

echo "🧹 Cleaning up zombie processes..."

# Kill tsx processes
echo "Killing tsx processes..."
killall tsx 2>/dev/null
killall -9 tsx 2>/dev/null

# Kill node processes running index.ts
echo "Killing node processes..."
pkill -f "node.*index.ts" 2>/dev/null

# Check if port 3000 is in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Port 3000 is in use, killing process..."
    kill $(lsof -t -i:3000) 2>/dev/null
fi

echo "✅ Cleanup complete!"
echo ""
echo "You can now run: npm run dev"
