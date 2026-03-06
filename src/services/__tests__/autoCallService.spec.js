import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import * as autoCallService from '../autoCallService'

// Mock axios
vi.mock('axios')

describe('autoCallService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCampaigns', () => {
    it('should fetch campaigns successfully', async () => {
      const mockCampaigns = [
        {
          id: 'campaign_1',
          name: 'Test Campaign',
          status: 'Активна',
          totalClients: 100
        }
      ]

      axios.get.mockResolvedValue({ data: mockCampaigns })

      const result = await autoCallService.getCampaigns()

      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/auto-call/campaigns'))
      expect(result).toEqual(mockCampaigns)
    })

    it('should handle errors when fetching campaigns', async () => {
      const error = new Error('Network error')
      axios.get.mockRejectedValue(error)

      await expect(autoCallService.getCampaigns()).rejects.toThrow('Network error')
    })
  })

  describe('createCampaign', () => {
    it('should create a new campaign', async () => {
      const campaignData = {
        name: 'New Campaign',
        description: 'Test description'
      }

      const mockResponse = {
        id: 'campaign_123',
        ...campaignData,
        status: 'Черновик'
      }

      axios.post.mockResolvedValue({ data: mockResponse })

      const result = await autoCallService.createCampaign(campaignData)

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auto-call/campaigns'),
        campaignData
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('startCampaign', () => {
    it('should start a campaign', async () => {
      const campaignId = 'campaign_123'
      const mockResponse = {
        id: campaignId,
        status: 'Активна'
      }

      axios.post.mockResolvedValue({ data: mockResponse })

      const result = await autoCallService.startCampaign(campaignId)

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/auto-call/campaigns/${campaignId}/start`)
      )
      expect(result.status).toBe('Активна')
    })
  })

  describe('pauseCampaign', () => {
    it('should pause a campaign', async () => {
      const campaignId = 'campaign_123'
      const mockResponse = {
        id: campaignId,
        status: 'Приостановлена'
      }

      axios.post.mockResolvedValue({ data: mockResponse })

      const result = await autoCallService.pauseCampaign(campaignId)

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/auto-call/campaigns/${campaignId}/pause`)
      )
      expect(result.status).toBe('Приостановлена')
    })
  })

  describe('getCallLogs', () => {
    it('should fetch call logs', async () => {
      const mockCallLogs = [
        {
          id: 'call_1',
          phoneNumber: '+79991234567',
          status: 'Успешен'
        }
      ]

      axios.get.mockResolvedValue({ data: mockCallLogs })

      const result = await autoCallService.getCallLogs()

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/auto-call/calls'),
        expect.any(Object)
      )
      expect(result).toEqual(mockCallLogs)
    })

    it('should fetch call logs with filters', async () => {
      const filters = {
        campaignId: 'campaign_123',
        status: 'Успешен'
      }

      axios.get.mockResolvedValue({ data: [] })

      await autoCallService.getCallLogs(filters)

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/auto-call/calls'),
        { params: filters }
      )
    })
  })

  describe('makeTestCall', () => {
    it('should make a test call', async () => {
      const phoneNumber = '+79991234567'
      const config = {
        voice: 'ru-RU-Wavenet-A',
        speechRate: 1.0
      }

      const mockResponse = {
        id: 'call_test_123',
        phoneNumber,
        status: 'Успешен'
      }

      axios.post.mockResolvedValue({ data: mockResponse })

      const result = await autoCallService.makeTestCall(phoneNumber, config)

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auto-call/test-call'),
        { phoneNumber, config }
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('saveAIConfig', () => {
    it('should save AI configuration', async () => {
      const config = {
        conversationScript: 'Test script',
        voice: 'ru-RU-Wavenet-A',
        speechRate: 1.0
      }

      axios.post.mockResolvedValue({ data: config })

      const result = await autoCallService.saveAIConfig(config)

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auto-call/config'),
        config
      )
      expect(result).toEqual(config)
    })
  })

  describe('getAIConfig', () => {
    it('should fetch AI configuration', async () => {
      const mockConfig = {
        conversationScript: 'Test script',
        voice: 'ru-RU-Wavenet-A'
      }

      axios.get.mockResolvedValue({ data: mockConfig })

      const result = await autoCallService.getAIConfig()

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/auto-call/config')
      )
      expect(result).toEqual(mockConfig)
    })
  })

  describe('getCampaignStats', () => {
    it('should fetch campaign statistics', async () => {
      const mockStats = {
        totalCalls: 100,
        successfulCalls: 75,
        failedCalls: 25
      }

      axios.get.mockResolvedValue({ data: mockStats })

      const result = await autoCallService.getCampaignStats()

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/auto-call/stats')
      )
      expect(result).toEqual(mockStats)
    })
  })

  describe('synthesizeSpeech', () => {
    it('should synthesize speech', async () => {
      const text = 'Привет, это тестовое сообщение'
      const options = {
        voice: 'ru-RU-Wavenet-A',
        speechRate: 1.0
      }

      const mockBlob = new Blob(['audio data'])
      axios.post.mockResolvedValue({ data: mockBlob })

      const result = await autoCallService.synthesizeSpeech(text, options)

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auto-call/tts'),
        { text, ...options },
        { responseType: 'blob' }
      )
      expect(result).toEqual(mockBlob)
    })
  })

  describe('transcribeAudio', () => {
    it('should transcribe audio', async () => {
      const audioBlob = new Blob(['audio data'])
      const language = 'ru-RU'

      const mockResponse = {
        transcript: 'Транскрипция',
        confidence: 0.95
      }

      axios.post.mockResolvedValue({ data: mockResponse })

      const result = await autoCallService.transcribeAudio(audioBlob, language)

      expect(axios.post).toHaveBeenCalled()
      expect(result).toEqual(mockResponse)
    })
  })
})
