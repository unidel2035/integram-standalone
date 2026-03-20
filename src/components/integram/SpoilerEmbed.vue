<template>
  <div class="spoiler-embed" @mousedown.stop @click.stop @dragstart.stop>
    <!-- Spoiler header - clickable to toggle -->
    <div
      class="spoiler-header"
      @click="toggleOpen"
      :class="{ 'spoiler-open': isOpen }"
    >
      <div class="spoiler-icon">
        <i :class="isOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
      </div>
      <div class="spoiler-title" contenteditable="true" @click.stop @keydown.stop @input="handleTitleEdit">
        {{ localTitle }}
      </div>
      <div class="spoiler-controls">
        <button
          class="ctrl-btn"
          title="Настройки"
          @click.stop="showSettings = !showSettings"
        >
          <i class="pi pi-cog"></i>
        </button>
      </div>
    </div>

    <!-- Settings panel (collapsible) -->
    <div v-if="showSettings" class="settings-panel">
      <div class="setting-row">
        <label>Заголовок спойлера</label>
        <InputText
          v-model="localTitle"
          placeholder="Введите заголовок..."
          class="w-full"
          @blur="saveSettings"
        />
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="localDefaultOpen" @change="saveSettings" />
          <span>Развёрнут по умолчанию</span>
        </label>
      </div>
    </div>

    <!-- Spoiler content - collapsible with nested Quill editor -->
    <Transition name="spoiler-collapse">
      <div v-show="isOpen" class="spoiler-content">
        <div class="spoiler-inner">
          <!-- Nested Quill editor container -->
          <div ref="editorEl" class="nested-editor"></div>
        </div>
      </div>
    </Transition>

    <!-- Slash command menu rendered at body level to avoid overflow clipping -->
    <Teleport to="body">
      <div
        v-if="showSlashMenu"
        class="spoiler-slash-menu"
        :style="slashMenuStyle"
      >
        <div class="slash-menu-scroll">
          <div
            v-for="(command, index) in filteredSlashCommands"
            :key="command.id"
            :class="['slash-command-item', { active: index === slashCommandIndex }]"
            @mousedown.prevent="executeSlashCommand(command)"
            @mouseenter="slashCommandIndex = index"
          >
            <i :class="['pi', command.icon]"></i>
            <div class="command-info">
              <div class="command-label">{{ command.label }}</div>
              <div class="command-description">{{ command.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import InputText from 'primevue/inputtext'
import Quill from 'quill'

const props = defineProps({
  title: { type: String, default: 'Нажмите, чтобы развернуть' },
  defaultOpen: { type: Boolean, default: false },
  embedEl: { type: Object, default: null },
  blockId: { type: [String, Number], default: null },
  initialContent: { type: String, default: '' },
  slashCommands: { type: Array, default: () => [] },
  // Issue #6920: Factory function to create commands for nested editor
  commandFactory: { type: Function, default: null }
})

const emit = defineEmits(['update:title', 'update:defaultOpen', 'update:isOpen', 'update:content'])

// Local state
const localTitle = ref(props.title)
const localDefaultOpen = ref(props.defaultOpen)
const isOpen = ref(props.defaultOpen)
const showSettings = ref(false)
const editorEl = ref(null)

// Nested Quill editor instance
let nestedEditor = null

// Slash menu state
const showSlashMenu = ref(false)
const slashMenuStyle = ref({})
const slashCommandIndex = ref(0)
const slashSearchQuery = ref('')

// Issue #6920: Commands for nested editor - created after editor initialization
const nestedCommands = ref([])

// Filtered slash commands
const filteredSlashCommands = computed(() => {
  // Use nested commands if available (created from factory), otherwise fallback to props
  const commands = nestedCommands.value.length > 0 ? nestedCommands.value : props.slashCommands

  if (!slashSearchQuery.value) return commands

  const query = slashSearchQuery.value.toLowerCase()
  return commands.filter(cmd =>
    cmd.label?.toLowerCase().includes(query) ||
    cmd.description?.toLowerCase().includes(query) ||
    cmd.category?.toLowerCase().includes(query)
  )
})

// Toggle open/closed
function toggleOpen() {
  isOpen.value = !isOpen.value
  emit('update:isOpen', isOpen.value)

  // Update data attribute on embed element
  if (props.embedEl) {
    props.embedEl.setAttribute('data-open', isOpen.value ? 'true' : 'false')
  }

  // Initialize editor when opening for the first time
  if (isOpen.value && !nestedEditor) {
    nextTick(() => {
      initializeEditor()
    })
  }
}

// Handle title edit via contenteditable
function handleTitleEdit(event) {
  const newTitle = event.target.textContent.trim()
  if (newTitle !== localTitle.value) {
    localTitle.value = newTitle
    saveSettings()
  }
}

// Save settings to embed element and emit events
function saveSettings() {
  emit('update:title', localTitle.value)
  emit('update:defaultOpen', localDefaultOpen.value)

  // Update data attributes on embed element
  if (props.embedEl) {
    props.embedEl.setAttribute('data-title', localTitle.value)
    props.embedEl.setAttribute('data-default-open', localDefaultOpen.value ? 'true' : 'false')
  }
}

// Save content to embed element
function saveContent() {
  if (!nestedEditor) return

  const html = nestedEditor.root.innerHTML
  emit('update:content', html)

  // Update data attribute on embed element
  if (props.embedEl) {
    props.embedEl.setAttribute('data-content', html)
  }
}

// Initialize nested Quill editor
function initializeEditor() {
  if (!editorEl.value || nestedEditor) return

  // Create Quill editor
  nestedEditor = new Quill(editorEl.value, {
    theme: 'snow',
    placeholder: 'Нажмите "/" для вставки блоков...',
    modules: {
      toolbar: false,
      keyboard: {
        bindings: {
          // Handle Escape to close menu
          escape: {
            key: 27,
            handler: function() {
              if (showSlashMenu.value) {
                hideSlashMenu()
                return false
              }
              return true
            }
          },
          // Handle Arrow Down in menu
          'arrow-down': {
            key: 40,
            handler: function() {
              if (showSlashMenu.value) {
                const commands = filteredSlashCommands.value
                slashCommandIndex.value = (slashCommandIndex.value + 1) % commands.length
                return false
              }
              return true
            }
          },
          // Handle Arrow Up in menu
          'arrow-up': {
            key: 38,
            handler: function() {
              if (showSlashMenu.value) {
                const commands = filteredSlashCommands.value
                slashCommandIndex.value = (slashCommandIndex.value - 1 + commands.length) % commands.length
                return false
              }
              return true
            }
          },
          // Handle Enter in menu — return false lets Quill insert newline when no menu
          enter: {
            key: 13,
            handler: function() {
              if (showSlashMenu.value) {
                const commands = filteredSlashCommands.value
                if (commands[slashCommandIndex.value]) {
                  executeSlashCommand(commands[slashCommandIndex.value])
                  return false
                }
              }
              return false // Let Quill's built-in Enter handler insert newline
            }
          }
        }
      }
    }
  })

  // Bug fix: stop keyboard events from bubbling to parent Quill editor
  // (prevents parent editor from processing Enter/arrows typed inside the spoiler)
  nestedEditor.root.addEventListener('keydown', (e) => { e.stopPropagation() }, true)
  nestedEditor.root.addEventListener('keypress', (e) => { e.stopPropagation() }, true)
  nestedEditor.root.addEventListener('keyup', (e) => { e.stopPropagation() })

  // Reliable '/' trigger via keyup (fires after character insertion, as fallback to text-change detection)
  nestedEditor.root.addEventListener('keyup', (e) => {
    if (e.key !== '/') return
    if (showSlashMenu.value) return
    const selection = nestedEditor.getSelection()
    if (selection) {
      showSlashMenuAtCursor(selection.index)
      slashSearchQuery.value = ''
    }
  })

  // Set initial content
  if (props.initialContent) {
    nestedEditor.root.innerHTML = props.initialContent
  }

  // Issue #6920: Create nested commands using factory if provided
  if (props.commandFactory && typeof props.commandFactory === 'function') {
    nestedCommands.value = props.commandFactory(nestedEditor)
  }

  // Listen for text changes to update slash search
  // Detection via text-change + setTimeout(0) to wait for Quill selection update
  // (getSelection() inside text-change returns stale position before setTimeout)
  nestedEditor.on('text-change', (delta, oldDelta, source) => {
    if (source !== 'user') return
    saveContent()

    setTimeout(() => {
      if (!nestedEditor) return
      const selection = nestedEditor.getSelection()
      if (!selection) return

      const text = nestedEditor.getText(0, selection.index)
      const lastSlashIndex = text.lastIndexOf('/')

      if (lastSlashIndex !== -1) {
        const afterSlash = text.substring(lastSlashIndex + 1)
        // Only allow word characters after '/' (no spaces — that would mean a new word, not a command)
        if (/^\w*$/.test(afterSlash)) {
          if (!showSlashMenu.value && afterSlash === '') {
            // '/' was just typed — show menu
            showSlashMenuAtCursor(selection.index)
            slashSearchQuery.value = ''
          } else if (showSlashMenu.value) {
            slashSearchQuery.value = afterSlash
          }
        } else if (showSlashMenu.value) {
          hideSlashMenu()
        }
      } else if (showSlashMenu.value) {
        hideSlashMenu()
      }
    }, 0)
  })

  // Listen for selection changes to hide menu when cursor moves
  nestedEditor.on('selection-change', (range, oldRange, source) => {
    if (range && showSlashMenu.value) {
      const text = nestedEditor.getText(0, range.index)
      const lastSlashIndex = text.lastIndexOf('/')
      if (lastSlashIndex === -1 || range.index - lastSlashIndex > 50) {
        hideSlashMenu()
      }
    }
  })
}

// Show slash menu at cursor position — uses position:fixed (Teleport to body)
// so the menu is never clipped by the spoiler's overflow:hidden
function showSlashMenuAtCursor(index) {
  if (!nestedEditor || !editorEl.value) return

  try {
    const safeIndex = Math.max(0, Math.min(index, nestedEditor.getLength() - 1))
    const bounds = nestedEditor.getBounds(safeIndex)
    if (!bounds) return

    // Convert editor-relative coords to screen coords for position:fixed
    const editorRect = nestedEditor.root.getBoundingClientRect()
    let left = editorRect.left + bounds.left
    let top = editorRect.top + bounds.bottom + 5

    // Clamp to viewport
    const menuWidth = 320
    const menuHeight = 300
    if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10
    if (left < 10) left = 10
    if (top + menuHeight > window.innerHeight - 10) top = editorRect.top + bounds.top - menuHeight - 5

    slashMenuStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 10000
    }

    showSlashMenu.value = true
    slashCommandIndex.value = 0
  } catch (e) {
    console.warn('SpoilerEmbed: failed to position slash menu', e)
  }
}

// Hide slash menu
function hideSlashMenu() {
  showSlashMenu.value = false
  slashSearchQuery.value = ''
}

// Execute slash command
function executeSlashCommand(command) {
  if (!nestedEditor || !command) return

  const selection = nestedEditor.getSelection()
  if (!selection) return

  // Find and remove the slash command text
  const text = nestedEditor.getText(0, selection.index)
  const lastSlashIndex = text.lastIndexOf('/')

  if (lastSlashIndex !== -1) {
    // Delete from slash to cursor
    nestedEditor.deleteText(lastSlashIndex, selection.index - lastSlashIndex)
    nestedEditor.setSelection(lastSlashIndex)
  }

  hideSlashMenu()

  // Execute the command action
  // Note: This is a simplified version. In the real implementation,
  // we'd need to pass the nested editor context to the command action.
  if (command.action && typeof command.action === 'function') {
    try {
      command.action()
    } catch (e) {
      console.error('Error executing slash command:', e)
    }
  }

  // For simple text insertions, we can insert directly
  if (command.insertText) {
    const index = nestedEditor.getSelection()?.index || 0
    nestedEditor.insertText(index, command.insertText)
  }
}

// Watch for prop changes
watch(() => props.title, (newVal) => {
  localTitle.value = newVal
})

watch(() => props.defaultOpen, (newVal) => {
  localDefaultOpen.value = newVal
  if (!isOpen.value) {
    isOpen.value = newVal
  }
})

watch(() => props.initialContent, (newVal) => {
  if (nestedEditor && newVal !== nestedEditor.root.innerHTML) {
    nestedEditor.root.innerHTML = newVal
  }
})

onMounted(() => {
  // Initialize editor immediately if spoiler is open by default
  if (isOpen.value) {
    nextTick(() => {
      initializeEditor()
    })
  }
})

onBeforeUnmount(() => {
  // Clean up editor instance
  if (nestedEditor) {
    nestedEditor = null
  }
})
</script>

<style scoped>
/* Notion-style toggle — no borders, no backgrounds, plain text block */
.spoiler-embed {
  margin: 2px 0;
}

.spoiler-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 2px 0;
  cursor: pointer;
  user-select: none;
  border-radius: 3px;
}

.spoiler-header:hover .spoiler-icon {
  color: var(--text-color);
}

.spoiler-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--text-color-secondary);
  flex-shrink: 0;
  transition: color 0.15s;
}

.spoiler-icon i {
  font-size: 0.75rem;
}

.spoiler-title {
  flex: 1;
  font-size: inherit;
  font-weight: inherit;
  color: var(--text-color);
  outline: none;
  min-height: 1.4em;
  line-height: 1.5;
}

.spoiler-title:empty::before {
  content: 'Переключатель';
  color: var(--text-color-secondary);
}

.spoiler-controls {
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.spoiler-header:hover .spoiler-controls {
  opacity: 1;
}

.ctrl-btn {
  padding: 2px 4px;
  border: none;
  background: transparent;
  color: var(--text-color-secondary);
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 0.75rem;
}

.ctrl-btn:hover {
  background: var(--surface-hover);
  color: var(--text-color);
}

.settings-panel {
  padding: 0.5rem 0 0.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-row label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  cursor: pointer;
}

.spoiler-content {
  /* No overflow:hidden — allows slash menu to escape */
}

.spoiler-inner {
  padding-left: 1.5rem;
  padding-top: 2px;
}

/* Nested editor — no border, no background, looks like regular text */
.nested-editor {
  min-height: 1.5em;
}

.nested-editor :deep(.ql-container.ql-snow) {
  border: none;
}

.nested-editor :deep(.ql-editor) {
  padding: 0;
  min-height: 1.5em;
  line-height: 1.5;
  font-size: inherit;
  color: var(--text-color);
}

.nested-editor :deep(.ql-editor.ql-blank::before) {
  color: var(--text-color-secondary);
  font-style: normal;
  left: 0;
}

/* Collapse transition */
.spoiler-collapse-enter-active,
.spoiler-collapse-leave-active {
  transition: opacity 0.2s ease;
}

.spoiler-collapse-enter-from,
.spoiler-collapse-leave-to {
  opacity: 0;
}
</style>

/* Slash menu — глобальные стили (вне scoped, т.к. Teleport рендерит вне компонента) */
<style>
.spoiler-slash-menu {
  background: var(--surface-card, #fff);
  border: 1px solid var(--surface-border, #e2e8f0);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  width: 320px;
  max-height: 300px;
  overflow: hidden;
}

.spoiler-slash-menu .slash-menu-scroll {
  max-height: 300px;
  overflow-y: auto;
}

.spoiler-slash-menu .slash-command-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.875rem;
  cursor: pointer;
  transition: background 0.15s;
}

.spoiler-slash-menu .slash-command-item:hover,
.spoiler-slash-menu .slash-command-item.active {
  background: var(--surface-100, #f1f5f9);
}

.spoiler-slash-menu .slash-command-item i {
  font-size: 1rem;
  color: var(--primary-color, #6366f1);
  width: 20px;
  flex-shrink: 0;
}

.spoiler-slash-menu .command-info { flex: 1; min-width: 0; }

.spoiler-slash-menu .command-label {
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--text-color, #1e293b);
}

.spoiler-slash-menu .command-description {
  font-size: 0.8rem;
  color: var(--text-color-secondary, #64748b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
