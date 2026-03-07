#!/bin/bash

# Script to add PageHelpDrawer to all FST pages
# Issue #115: Контекстная панель помощи

# Array of pages with their route IDs
declare -A pages=(
  ["FstDeal.vue"]="fst-deal"
  ["FstPortfolio.vue"]="fst-portfolio"
  ["FstExecution.vue"]="fst-execution"
  ["FstDigitalTwin.vue"]="fst-twin"
  ["FstFundTwin.vue"]="fst-fund"
  ["FstProtocol.vue"]="fst-protocol"
  ["FstLearning.vue"]="fst-learning"
  ["FstIntelligence.vue"]="fst-intelligence"
  ["FstAllocation.vue"]="fst-allocation"
  ["FstApply.vue"]="fst-apply"
  ["FstSourcing.vue"]="fst-sourcing"
  ["FstSyndication.vue"]="fst-syndication"
  ["FstFounders.vue"]="fst-founders"
  ["FstBoard.vue"]="fst-board"
  ["FstTransparency.vue"]="fst-transparency"
  ["FstAdministration.vue"]="fst-administration"
  ["FstGlossary.vue"]="fst-glossary"
  ["FstBenchmark.vue"]="fst-benchmark"
  ["FstSecondary.vue"]="fst-secondary"
)

BASE_DIR="src/views/pages"

for page_file in "${!pages[@]}"; do
  page_id="${pages[$page_file]}"
  file_path="$BASE_DIR/$page_file"

  echo "Processing $page_file (ID: $page_id)..."

  # Check if file exists
  if [ ! -f "$file_path" ]; then
    echo "  ⚠️  File not found: $file_path"
    continue
  fi

  # Check if already has PageHelpDrawer
  if grep -q "PageHelpDrawer" "$file_path"; then
    echo "  ✓ Already has PageHelpDrawer, skipping"
    continue
  fi

  echo "  → Adding PageHelpDrawer to $page_file..."

  # Note: Actual implementation would require careful parsing of each file
  # For now, we'll mark this for manual review
  echo "  ℹ️  Manual update needed for $page_file"
done

echo "Done!"
