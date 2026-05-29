#!/bin/bash
# Reset timestamps for files that Obsidian has touched but not actually modified
# This prevents git from showing them as modified

echo "Resetting Obsidian timestamp changes..."

# Find all modified files
git diff --name-only | while read file; do
    if [ -f "$file" ]; then
        # Check if file content actually changed
        if git diff --quiet "$file" 2>/dev/null; then
            # Content unchanged, checkout to reset timestamp
            git checkout -- "$file" 2>/dev/null
            echo "Reset: $file"
        fi
    fi
done

echo "Done."
