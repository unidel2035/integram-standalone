/**
 * Tests for ProposalGeneratorService
 *
 * Issue #4467 - Business Intelligence-driven Proposal Generator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import ProposalGeneratorService from '../ProposalGeneratorService.js'

describe('ProposalGeneratorService', () => {
  let service
  let mockDb

  beforeEach(() => {
    mockDb = {}
    service = new ProposalGeneratorService({ db: mockDb })
  })

  describe('Industry Detection', () => {
    it('should detect IT industry from description', async () => {
      const companyData = {
        name: 'Tech Company',
        description: 'Мы занимаемся разработкой программного обеспечения',
        domain: 'techcompany.ru'
      }

      const result = await service.detectIndustryAndRegion(companyData)

      expect(result.okved).toBe('62.01')
      expect(result.industry).toBe('Разработка программного обеспечения')
      expect(result.targetPositions).toContain('программист')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should detect marketing industry from description', async () => {
      const companyData = {
        name: 'Marketing Agency',
        description: 'Агентство маркетинга и рекламы',
        domain: 'marketing.ru'
      }

      const result = await service.detectIndustryAndRegion(companyData)

      expect(result.okved).toBe('73.11')
      expect(result.industry).toBe('Рекламная деятельность')
      expect(result.targetPositions).toContain('маркетолог')
    })

    it('should return low confidence when industry cannot be detected', async () => {
      const companyData = {
        name: 'Unknown Company',
        description: 'Some generic description',
        domain: 'unknown.ru'
      }

      const result = await service.detectIndustryAndRegion(companyData)

      expect(result.confidence).toBe(0.0)
      expect(result.industry).toContain('Не определена')
    })
  })

  describe('Employee Cost Calculation', () => {
    it('should return error when no positions provided', async () => {
      const result = await service.calculateEmployeeCost({
        okved: null,
        region: 'Москва',
        positions: []
      })

      expect(result.error).toBeTruthy()
      expect(result.averageSalary).toBe(0)
      expect(result.fullCost).toBe(0)
    })

    it('should calculate full cost with 30% overhead', async () => {
      // Mock parseHHSalary to return a fixed salary
      vi.spyOn(service, 'parseHHSalary').mockResolvedValue(100000)

      const result = await service.calculateEmployeeCost({
        okved: '62.01',
        region: 'Москва',
        positions: ['программист']
      })

      expect(result.averageSalary).toBe(100000)
      expect(result.fullCost).toBe(130000) // 100k * 1.3
      expect(result.dataPoints).toBe(1)
    })

    it('should calculate median salary from multiple positions', async () => {
      // Mock parseHHSalary to return different salaries
      const salaries = [80000, 100000, 120000]
      let callIndex = 0
      vi.spyOn(service, 'parseHHSalary').mockImplementation(() => {
        return Promise.resolve(salaries[callIndex++])
      })

      const result = await service.calculateEmployeeCost({
        okved: '62.01',
        region: 'Москва',
        positions: ['программист', 'тестировщик', 'разработчик']
      })

      expect(result.averageSalary).toBe(100000) // median of [80k, 100k, 120k]
      expect(result.fullCost).toBe(130000)
      expect(result.dataPoints).toBe(3)
    })
  })

  describe('Routine Analysis', () => {
    it('should calculate routine time for website with products', () => {
      const websiteData = {
        url: 'https://example.com',
        productCount: 10,
        faqCount: 5,
        formsCount: 2,
        blogPostsCount: 3
      }

      const result = service.analyzeWebsiteRoutine(websiteData)

      expect(result.breakdown.productUpdates.totalMinutes).toBe(10 * 20) // 10 products * 20 min
      expect(result.breakdown.faqManagement.totalMinutes).toBe(5 * 15) // 5 FAQ * 15 min
      expect(result.totalMinutesPerMonth).toBeGreaterThan(0)
      expect(result.totalHoursPerMonth).toBeGreaterThan(0)
      expect(result.equivalentFTE).toBeTruthy()
    })

    it('should return zero routine time for website without data', () => {
      const websiteData = {
        error: 'Website not accessible'
      }

      const result = service.analyzeWebsiteRoutine(websiteData)

      expect(result.error).toBeTruthy()
      expect(result.totalMinutesPerMonth).toBe(0)
    })

    it('should calculate FTE (Full-Time Equivalent) correctly', () => {
      const websiteData = {
        url: 'https://example.com',
        productCount: 100, // 100 * 20 = 2000 min
        faqCount: 50,      // 50 * 15 = 750 min
        formsCount: 10,    // 10 * 30 * 10 = 3000 min
        blogPostsCount: 5  // 5 * 120 = 600 min
      }

      const result = service.analyzeWebsiteRoutine(websiteData)

      // Total: 2000 + 750 + 3000 + 600 = 6350 minutes
      // Hours: 6350 / 60 ≈ 105.83 hours
      // FTE: 105.83 / 160 ≈ 0.66
      expect(result.totalMinutesPerMonth).toBe(6350)
      expect(result.totalHoursPerMonth).toBeCloseTo(105, 0)
      expect(parseFloat(result.equivalentFTE)).toBeCloseTo(0.66, 1)
    })
  })

  describe('Data Extraction', () => {
    it('should extract email from HTML content', () => {
      const html = '<div>Contact us at info@example.com</div>'
      const email = service.extractEmail(html)

      expect(email).toBe('info@example.com')
    })

    it('should extract phone from HTML content', () => {
      const html = '<div>Call us: +7 (495) 123-45-67</div>'
      const phone = service.extractPhone(html)

      expect(phone).toBeTruthy()
      expect(phone).toContain('495')
    })

    it('should return null when email not found', () => {
      const html = '<div>No email here</div>'
      const email = service.extractEmail(html)

      expect(email).toBeNull()
    })

    it('should return null when phone not found', () => {
      const html = '<div>No phone here</div>'
      const phone = service.extractPhone(html)

      expect(email).toBeNull()
    })
  })

  describe('Proposal Generation Prompt', () => {
    it('should build comprehensive prompt with all data', () => {
      const params = {
        companyData: {
          name: 'Test Company',
          domain: 'test.ru',
          description: 'Test description'
        },
        industryData: {
          industry: 'IT',
          region: 'Москва',
          okved: '62.01'
        },
        employeeCost: {
          positions: ['программист'],
          averageSalary: 100000,
          fullCost: 130000
        },
        routineAnalysis: {
          totalHoursPerMonth: 80,
          equivalentFTE: 0.5,
          breakdown: {
            productUpdates: { count: 10, minutesPerItem: 20, totalMinutes: 200 },
            faqManagement: { count: 5, minutesPerItem: 15, totalMinutes: 75 },
            formProcessing: { count: 30, minutesPerItem: 10, totalMinutes: 300 },
            contentCreation: { count: 2, minutesPerItem: 120, totalMinutes: 240 }
          }
        },
        competitiveContext: {}
      }

      const prompt = service.buildProposalPrompt(params)

      expect(prompt).toContain('Test Company')
      expect(prompt).toContain('test.ru')
      expect(prompt).toContain('IT')
      expect(prompt).toContain('Москва')
      expect(prompt).toContain('100000')
      expect(prompt).toContain('130000')
      expect(prompt).toContain('80 часов/мес')
      expect(prompt).toContain('Value-Based Selling')
    })
  })

  describe('Basic Proposal Generation (Fallback)', () => {
    it('should generate basic HTML proposal without AI', () => {
      const params = {
        companyData: {
          name: 'Test Company'
        },
        industryData: {
          industry: 'IT',
          region: 'Москва'
        },
        employeeCost: {
          fullCost: 130000,
          positions: ['программист']
        },
        routineAnalysis: {
          totalHoursPerMonth: 80
        }
      }

      const proposal = service.generateBasicProposal(params)

      expect(proposal).toContain('Test Company')
      expect(proposal).toContain('130000')
      expect(proposal).toContain('IT')
      expect(proposal).toContain('<div')
      expect(proposal).toContain('</div>')
      expect(proposal).toContain('91000') // 130k * 0.7 savings
    })
  })

  describe('OKVED Job Mapping', () => {
    it('should have correct mappings for common OKVEDs', () => {
      expect(service.okvedJobMapping['62.01']).toContain('программист')
      expect(service.okvedJobMapping['73.11']).toContain('маркетолог')
      expect(service.okvedJobMapping['47.91']).toContain('продавец-консультант')
      expect(service.okvedJobMapping['56.10']).toContain('официант')
    })
  })

  describe('Time Estimates', () => {
    it('should have reasonable time estimates for tasks', () => {
      expect(service.timeEstimates.product_update).toBeGreaterThan(0)
      expect(service.timeEstimates.faq_answer).toBeGreaterThan(0)
      expect(service.timeEstimates.form_processing).toBeGreaterThan(0)
      expect(service.timeEstimates.article_writing).toBeGreaterThan(0)

      // Article writing should take more time than product update
      expect(service.timeEstimates.article_writing).toBeGreaterThan(service.timeEstimates.product_update)
    })
  })
})
