/**
 * Custom Quill Blot for embedding SimpleTableBlock in BlockDocumentEditor
 * Issue #6677: Redesign SimpleTableBlock — Excel-like table in Block Editor
 *
 * Data model (stored in data-value as JSON):
 * {
 *   "headerTheme": "blue",
 *   "columns": [
 *     { "id": "c0", "label": "Название", "width": 150, "order": 0 }
 *   ],
 *   "rows": [
 *     {
 *       "id": "r0",
 *       "order": 0,
 *       "color": null,
 *       "cells": {
 *         "c0": { "value": "Товар А", "formula": null, "rowspan": 1, "colspan": 1 }
 *       }
 *     }
 *   ]
 * }
 *
 * The actual SimpleTableBlock Vue component is mounted by BlockDocumentEditor's
 * remountEmbeddedComponents() — same pattern as TechPyramidBlot.
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class SimpleTableBlot extends BlockEmbed {
  static blotName = 'simple-table'
  static tagName = 'div'
  static className = 'coda-simple-table-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    // Store the table data as JSON in data-value
    const data = value && typeof value === 'object' ? value : {}
    node.dataset.value = JSON.stringify(data)

    // Render a placeholder until the Vue component is mounted
    node.innerHTML = `
      <div class="simple-table-placeholder" style="padding:16px;border:1px solid var(--surface-border, #e2e8f0);border-radius:8px;display:flex;align-items:center;gap:10px;color:var(--p-text-muted-color,#64748b);font-family:Inter,system-ui,sans-serif;font-size:13px;">
        <i class="pi pi-table" style="font-size:1.2rem;"></i>
        <span>Загрузка таблицы…</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {}
    }
  }
}

Quill.register(SimpleTableBlot)

export { SimpleTableBlot }
