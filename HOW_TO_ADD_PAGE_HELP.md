# How to Add Page Help to FST Pages

This guide shows how to add the PageHelpDrawer component to any FST page.

## Status

✅ **Already implemented:**
- FstCommittee.vue
- FstHub.vue
- FstDeal.vue

🔄 **Remaining pages (need manual update):**
- FstPortfolio.vue
- FstExecution.vue
- FstDigitalTwin.vue
- FstFundTwin.vue
- FstProtocol.vue
- FstLearning.vue
- FstIntelligence.vue
- FstAllocation.vue
- FstApply.vue
- FstSourcing.vue
- FstSyndication.vue
- FstFounders.vue
- FstBoard.vue
- FstTransparency.vue
- FstAdministration.vue
- FstGlossary.vue
- FstBenchmark.vue
- FstSecondary.vue

## Implementation Pattern

### Step 1: Add imports in `<script setup>` section

```javascript
import PageHelpDrawer from '@/components/PageHelpDrawer.vue'
import { usePageHelp } from '@/composables/usePageHelp'
```

### Step 2: Initialize composable

Add near other composables/refs:

```javascript
// Page Help
const { isOpen: helpOpen, pageHelp, toggleHelp } = usePageHelp('PAGE-ID-HERE')
```

Replace `'PAGE-ID-HERE'` with the appropriate ID from `pageHelp.js`:
- 'fst-committee' for FstCommittee.vue
- 'fst-deal' for FstDeal.vue
- 'fst-portfolio' for FstPortfolio.vue
- etc.

### Step 3: Add help button to toolbar/header

Find the toolbar-right or header-right section and add:

```vue
<Button
  icon="pi pi-question-circle"
  severity="secondary"
  size="small"
  text
  @click="toggleHelp"
  title="Помощь по странице"
/>
```

### Step 4: Add drawer component before `</template>`

```vue
  <!-- Page Help Drawer -->
  <PageHelpDrawer v-model:visible="helpOpen" :page-help="pageHelp" />
</template>
```

## Page ID Reference

Map of component files to page IDs:

| File | Page ID |
|------|---------|
| FstCommittee.vue | fst-committee |
| FstHub.vue | fst |
| FstDeal.vue | fst-deal |
| FstPortfolio.vue | fst-portfolio |
| FstExecution.vue | fst-execution |
| FstDigitalTwin.vue | fst-twin |
| FstFundTwin.vue | fst-fund |
| FstProtocol.vue | fst-protocol |
| FstLearning.vue | fst-learning |
| FstIntelligence.vue | fst-intelligence |
| FstAllocation.vue | fst-allocation |
| FstApply.vue | fst-apply |
| FstSourcing.vue | fst-sourcing |
| FstSyndication.vue | fst-syndication |
| FstFounders.vue | fst-founders |
| FstBoard.vue | fst-board |
| FstTransparency.vue | fst-transparency |
| FstAdministration.vue | fst-administration |
| FstGlossary.vue | fst-glossary |
| FstBenchmark.vue | fst-benchmark |
| FstSecondary.vue | fst-secondary |

## Testing

After adding to a page:

1. Navigate to the page
2. Click the «?» button in the toolbar
3. Verify the drawer opens from the right (360px width)
4. Check that content loads correctly
5. Verify ESC key closes the drawer
6. Test clicking on related module chips for navigation

## Features

- **Icon & Title**: Each page help has custom icon and title
- **Description**: What the page does
- **How to Start**: Step-by-step guide
- **Scenarios**: Common use cases
- **Related Modules**: Navigation chips to related pages
- **Flow visualization**: Shows workflow (e.g., "Дилфлоу → ИК → Сделка")
