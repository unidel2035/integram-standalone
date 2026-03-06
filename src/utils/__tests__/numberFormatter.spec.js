/**
 * Unit tests for number formatter utilities (Issue #6867)
 */

import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatThousands,
  formatCurrency,
  formatPercent,
  formatProgressBar,
  formatRing,
  formatStars,
  formatCheckbox,
  getCurrencySymbol,
  parseNumberFormat,
  buildNumberFormatAttrs
} from '../numberFormatter.js'

describe('numberFormatter', () => {
  describe('formatThousands', () => {
    it('formats numbers with space separator', () => {
      expect(formatThousands(1234567, 'space', 0)).toBe('1 234 567')
      expect(formatThousands(1000, 'space', 0)).toBe('1 000')
    })

    it('formats numbers with comma separator', () => {
      expect(formatThousands(1234567, 'comma', 0)).toBe('1,234,567')
    })

    it('formats numbers with dot separator', () => {
      expect(formatThousands(1234567, 'dot', 0)).toBe('1.234.567')
    })

    it('formats numbers without separator', () => {
      expect(formatThousands(1234567, 'none', 0)).toBe('1234567')
    })

    it('formats numbers with decimal places', () => {
      expect(formatThousands(1234.567, 'space', 2)).toBe('1 235.57')
      expect(formatThousands(1234.5, 'space', 2)).toBe('1 235.50')
    })

    it('handles null and undefined', () => {
      expect(formatThousands(null, 'space', 0)).toBe('')
      expect(formatThousands(undefined, 'space', 0)).toBe('')
    })
  })

  describe('getCurrencySymbol', () => {
    it('returns correct currency symbols', () => {
      expect(getCurrencySymbol('RUB')).toBe('₽')
      expect(getCurrencySymbol('USD')).toBe('$')
      expect(getCurrencySymbol('EUR')).toBe('€')
      expect(getCurrencySymbol('GBP')).toBe('£')
    })

    it('returns code for unknown currencies', () => {
      expect(getCurrencySymbol('XYZ')).toBe('XYZ')
    })
  })

  describe('formatCurrency', () => {
    it('formats currency with symbol before', () => {
      const config = {
        currency: 'USD',
        separator: 'comma',
        decimals: 2,
        currencyPosition: 'before'
      }
      const result = formatCurrency(1234.56, config)
      expect(result).toContain('$')
      expect(result).toContain('1,235')
    })

    it('formats currency with symbol after', () => {
      const config = {
        currency: 'RUB',
        separator: 'space',
        decimals: 2,
        currencyPosition: 'after'
      }
      const result = formatCurrency(1234.56, config)
      expect(result).toContain('₽')
      expect(result).toContain('1 235')
    })
  })

  describe('formatPercent', () => {
    it('formats percentage without multiplying', () => {
      const config = { decimals: 0, separator: 'none', divideBy100: false }
      const result = formatPercent(75, config)
      expect(result).toContain('75%')
    })

    it('formats percentage with multiplication', () => {
      const config = { decimals: 0, separator: 'none', divideBy100: true }
      const result = formatPercent(0.75, config)
      expect(result).toContain('75%')
    })

    it('formats percentage with decimals', () => {
      const config = { decimals: 2, separator: 'none', divideBy100: true }
      const result = formatPercent(0.7567, config)
      expect(result).toContain('75.67%')
    })
  })

  describe('formatProgressBar', () => {
    it('renders progress bar with value', () => {
      const config = { min: 0, max: 100, color: '#4CAF50', showValue: true }
      const result = formatProgressBar(65, config)
      expect(result).toContain('cell-progress-bar')
      expect(result).toContain('width: 65%')
      expect(result).toContain('65')
    })

    it('renders progress bar without value', () => {
      const config = { min: 0, max: 100, color: '#4CAF50', showValue: false }
      const result = formatProgressBar(65, config)
      expect(result).toContain('cell-progress-bar')
      expect(result).not.toContain('progress-value')
    })

    it('handles custom min/max range', () => {
      const config = { min: 50, max: 150, color: '#4CAF50', showValue: true }
      const result = formatProgressBar(100, config)
      expect(result).toContain('width: 50%')
    })

    it('clamps values to 0-100%', () => {
      const config = { min: 0, max: 100, color: '#4CAF50', showValue: true }
      expect(formatProgressBar(-10, config)).toContain('width: 0%')
      expect(formatProgressBar(150, config)).toContain('width: 100%')
    })
  })

  describe('formatRing', () => {
    it('renders SVG ring with value', () => {
      const config = { min: 0, max: 100, color: '#4CAF50', showValue: true }
      const result = formatRing(65, config)
      expect(result).toContain('cell-ring-progress')
      expect(result).toContain('svg')
      expect(result).toContain('65')
    })

    it('renders SVG ring without value', () => {
      const config = { min: 0, max: 100, color: '#4CAF50', showValue: false }
      const result = formatRing(65, config)
      expect(result).toContain('cell-ring-progress')
      expect(result).not.toContain('ring-value')
    })
  })

  describe('formatStars', () => {
    it('renders 5-star rating', () => {
      const config = { maxStars: 5 }
      const result = formatStars(3, config)
      expect(result).toContain('cell-stars')
      expect(result).toContain('star-filled')
      expect(result).toContain('star-empty')
      // 3 filled stars
      expect((result.match(/star-filled/g) || []).length).toBe(3)
      // 2 empty stars
      expect((result.match(/star-empty/g) || []).length).toBe(2)
    })

    it('renders 10-star rating', () => {
      const config = { maxStars: 10 }
      const result = formatStars(7, config)
      expect((result.match(/star-filled/g) || []).length).toBe(7)
      expect((result.match(/star-empty/g) || []).length).toBe(3)
    })

    it('handles values outside range', () => {
      const config = { maxStars: 5 }
      expect(formatStars(0, config)).toContain('cell-stars')
      expect((formatStars(0, config).match(/star-filled/g) || []).length).toBe(0)
      expect((formatStars(10, config).match(/star-filled/g) || []).length).toBe(5)
    })
  })

  describe('formatCheckbox', () => {
    it('renders checked state for 1', () => {
      const result = formatCheckbox(1)
      expect(result).toContain('cell-checkbox-checked')
    })

    it('renders unchecked state for 0', () => {
      const result = formatCheckbox(0)
      expect(result).toContain('cell-checkbox-unchecked')
    })
  })

  describe('parseNumberFormat', () => {
    it('parses empty attrs as default config', () => {
      const config = parseNumberFormat('')
      expect(config.type).toBe('number')
      expect(config.separator).toBe('space')
    })

    it('parses currency format', () => {
      const config = parseNumberFormat(':fmt=currency:cur=USD:dec=2:')
      expect(config.type).toBe('currency')
      expect(config.currency).toBe('USD')
      expect(config.decimals).toBe(2)
    })

    it('parses progress bar format', () => {
      const config = parseNumberFormat(':fmt=progress:min=0:max=100:color=#FF0000:')
      expect(config.type).toBe('progress')
      expect(config.min).toBe(0)
      expect(config.max).toBe(100)
      expect(config.color).toBe('#FF0000')
    })

    it('parses percent format with div100', () => {
      const config = parseNumberFormat(':fmt=percent:div100=1:')
      expect(config.type).toBe('percent')
      expect(config.divideBy100).toBe(true)
    })
  })

  describe('buildNumberFormatAttrs', () => {
    it('builds empty attrs for default number format', () => {
      const attrs = buildNumberFormatAttrs({ type: 'number', decimals: 0, separator: 'space' })
      expect(attrs).toBe('')
    })

    it('builds currency attrs', () => {
      const config = {
        type: 'currency',
        currency: 'EUR',
        decimals: 2,
        separator: 'comma',
        currencyPosition: 'after'
      }
      const attrs = buildNumberFormatAttrs(config)
      expect(attrs).toContain('fmt=currency')
      expect(attrs).toContain('cur=EUR')
      expect(attrs).toContain('dec=2')
      expect(attrs).toContain('sep=comma')
      expect(attrs).toContain('curpos=after')
    })

    it('builds progress attrs', () => {
      const config = {
        type: 'progress',
        min: 10,
        max: 90,
        color: '#00FF00',
        showValue: false
      }
      const attrs = buildNumberFormatAttrs(config)
      expect(attrs).toContain('fmt=progress')
      expect(attrs).toContain('min=10')
      expect(attrs).toContain('max=90')
      expect(attrs).toContain('color=#00FF00')
      expect(attrs).toContain('showval=0')
    })

    it('builds stars attrs', () => {
      const config = {
        type: 'stars',
        maxStars: 10
      }
      const attrs = buildNumberFormatAttrs(config)
      expect(attrs).toContain('fmt=stars')
      expect(attrs).toContain('stars=10')
    })
  })

  describe('formatNumber (main function)', () => {
    it('formats with default config', () => {
      const result = formatNumber(1234.56, { type: 'number', separator: 'space', decimals: 0 })
      expect(result).toContain('1 235')
    })

    it('routes to currency formatter', () => {
      const config = { type: 'currency', currency: 'USD', separator: 'comma', decimals: 2, currencyPosition: 'before' }
      const result = formatNumber(1234.56, config)
      expect(result).toContain('$')
      expect(result).toContain('cell-currency')
    })

    it('routes to percent formatter', () => {
      const config = { type: 'percent', decimals: 0, divideBy100: false }
      const result = formatNumber(75, config)
      expect(result).toContain('%')
    })

    it('routes to progress formatter', () => {
      const config = { type: 'progress', min: 0, max: 100, color: '#4CAF50', showValue: true }
      const result = formatNumber(65, config)
      expect(result).toContain('cell-progress-bar')
    })

    it('routes to ring formatter', () => {
      const config = { type: 'ring', min: 0, max: 100, color: '#4CAF50', showValue: true }
      const result = formatNumber(65, config)
      expect(result).toContain('cell-ring-progress')
    })

    it('routes to stars formatter', () => {
      const config = { type: 'stars', maxStars: 5 }
      const result = formatNumber(3, config)
      expect(result).toContain('cell-stars')
    })

    it('routes to checkbox formatter', () => {
      const config = { type: 'checkbox' }
      expect(formatNumber(1, config)).toContain('cell-checkbox-checked')
      expect(formatNumber(0, config)).toContain('cell-checkbox-unchecked')
    })
  })
})
