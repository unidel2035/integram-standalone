/**
 * Unit tests for ChatHistoryDialog component
 * Tests the stripMarkdown function used in getLastMessage preview
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatHistoryDialog from '../ChatHistoryDialog.vue'

// Mock PrimeVue components
vi.mock('primevue/dialog', () => ({
  default: {
    name: 'Dialog',
    template: '<div class="p-dialog"><slot name="header" /><slot /></div>',
    props: ['visible', 'modal', 'closable', 'draggable']
  }
}))

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button @click="$emit(\'click\')"><slot /></button>',
    props: ['icon', 'severity', 'text', 'rounded', 'disabled', 'label']
  }
}))

vi.mock('primevue/inputtext', () => ({
  default: {
    name: 'InputText',
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue']
  }
}))

vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="p-badge">{{ value }}</span>',
    props: ['value', 'severity']
  }
}))

describe('ChatHistoryDialog', () => {
  const makeWrapper = (savedChats = []) => mount(ChatHistoryDialog, {
    props: {
      visible: true,
      savedChats,
      canSaveCurrentChat: false
    }
  })

  describe('getLastMessage - markdown stripping', () => {
    it('strips bold markdown from last message preview', () => {
      const wrapper = makeWrapper([{
        name: 'Test Chat',
        date: '2024-01-01',
        messages: [{ text: '**bold text** here' }]
      }])

      const previewText = wrapper.find('.preview-text')
      expect(previewText.exists()).toBe(true)
      expect(previewText.text()).toContain('bold text here')
      expect(previewText.text()).not.toContain('**')
    })

    it('strips italic markdown from last message preview', () => {
      const wrapper = makeWrapper([{
        name: 'Test Chat',
        date: '2024-01-01',
        messages: [{ text: '*italic text*' }]
      }])

      const previewText = wrapper.find('.preview-text')
      expect(previewText.text()).toContain('italic text')
      expect(previewText.text()).not.toContain('*italic')
    })

    it('strips heading markers from last message preview', () => {
      const wrapper = makeWrapper([{
        name: 'Test Chat',
        date: '2024-01-01',
        messages: [{ text: '# Heading text' }]
      }])

      const previewText = wrapper.find('.preview-text')
      expect(previewText.text()).toContain('Heading text')
      expect(previewText.text()).not.toContain('# ')
    })

    it('replaces code blocks with [код] placeholder', () => {
      const wrapper = makeWrapper([{
        name: 'Test Chat',
        date: '2024-01-01',
        messages: [{ text: 'Here is code:\n```\nconsole.log("hello")\n```\nend' }]
      }])

      const previewText = wrapper.find('.preview-text')
      expect(previewText.text()).toContain('[код]')
      expect(previewText.text()).not.toContain('console.log')
    })

    it('strips markdown links but keeps link text', () => {
      const wrapper = makeWrapper([{
        name: 'Test Chat',
        date: '2024-01-01',
        messages: [{ text: 'Visit [Google](https://google.com) for search' }]
      }])

      const previewText = wrapper.find('.preview-text')
      expect(previewText.text()).toContain('Google')
      expect(previewText.text()).not.toContain('https://google.com')
      expect(previewText.text()).not.toContain('[Google]')
    })

    it('strips blockquotes from last message preview', () => {
      const wrapper = makeWrapper([{
        name: 'Test Chat',
        date: '2024-01-01',
        messages: [{ text: '> quoted text here' }]
      }])

      const previewText = wrapper.find('.preview-text')
      expect(previewText.text()).toContain('quoted text here')
      expect(previewText.text()).not.toContain('> ')
    })

    it('returns "Нет сообщений" when no messages', () => {
      const wrapper = makeWrapper([{
        name: 'Test Chat',
        date: '2024-01-01',
        messages: []
      }])

      const previewText = wrapper.find('.preview-text')
      expect(previewText.exists()).toBe(false)
    })

    it('truncates long text to 80 characters with ellipsis', () => {
      const longText = 'A'.repeat(100)
      const wrapper = makeWrapper([{
        name: 'Test Chat',
        date: '2024-01-01',
        messages: [{ text: longText }]
      }])

      const previewText = wrapper.find('.preview-text')
      expect(previewText.text()).toHaveLength(83) // 80 chars + '...'
      expect(previewText.text()).toEndWith('...')
    })

    it('handles plain text without markdown correctly', () => {
      const wrapper = makeWrapper([{
        name: 'Test Chat',
        date: '2024-01-01',
        messages: [{ text: 'Simple plain text message' }]
      }])

      const previewText = wrapper.find('.preview-text')
      expect(previewText.text()).toBe('Simple plain text message')
    })

    it('uses the last message with text, not the last element', () => {
      const wrapper = makeWrapper([{
        name: 'Test Chat',
        date: '2024-01-01',
        messages: [
          { text: 'First message' },
          { text: '**Last message with bold**' },
          { text: '' }  // empty, should be skipped
        ]
      }])

      const previewText = wrapper.find('.preview-text')
      expect(previewText.text()).toContain('Last message with bold')
      expect(previewText.text()).not.toContain('**')
    })
  })
})
