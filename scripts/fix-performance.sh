#!/bin/bash

# Script to fix macOS performance issues with Next.js development

echo "🔧 Fixing Next.js performance issues..."

# 1. Clear Next.js cache
echo "📦 Clearing Next.js cache..."
rm -rf .next/cache
echo "✅ Cache cleared"

# 2. Kill iCloud sync for this directory (temporary)
echo "☁️ Stopping iCloud sync (bird process)..."
killall bird 2>/dev/null || echo "bird process not running"
echo "⚠️  Note: iCloud sync will restart. To permanently disable, go to System Settings > Apple ID > iCloud > iCloud Drive > Options and uncheck 'Desktop and Documents Folders'"

# 3. Clear npm cache
echo "🧹 Clearing npm cache..."
npm cache clean --force
echo "✅ npm cache cleared"

# 4. Check disk space
echo "💾 Checking disk space..."
df -h . | tail -1

# 5. Show Next.js process memory usage
echo "📊 Current Next.js memory usage:"
ps aux | grep -E "next-server" | grep -v grep | awk '{print "  PID:", $2, "Memory:", $6/1024/1024 "GB", "CPU:", $3"%"}'

echo ""
echo "✅ Performance fixes applied!"
echo ""
echo "📝 Next steps:"
echo "1. Restart your dev server: npm run dev"
echo "2. If still slow, restart your Mac to clear system memory"
echo "3. Consider disabling iCloud Drive sync for Desktop folder"

