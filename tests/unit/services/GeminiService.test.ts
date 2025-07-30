import { GeminiService } from '@/services/gemini-service';
import { GoogleGenAI } from '@google/genai';
import { CUIError } from '@/types/errors';
import { createLogger } from '@/utils/logger';
import { configService } from '@/services/ConfigService';

// Mock dependencies
jest.mock('@google/genai');
jest.mock('@/utils/logger');
jest.mock('@/services/ConfigService');

describe('GeminiService', () => {
  let geminiService: GeminiService;
  let mockLogger: any;
  let mockGenAI: any;
  let mockGenerateContent: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    (createLogger as jest.Mock).mockReturnValue(mockLogger);

    // Mock generateContent function
    mockGenerateContent = jest.fn();

    // Mock GoogleGenAI
    mockGenAI = {
      models: {
        generateContent: mockGenerateContent
      }
    };
    (GoogleGenAI as jest.Mock).mockImplementation(() => mockGenAI);

    // Mock config service
    (configService.getConfig as jest.Mock).mockReturnValue({
      gemini: {
        apiKey: 'test-api-key',
        model: 'gemini-2.5-flash'
      }
    });

    // Create service instance
    geminiService = new GeminiService();
  });

  describe('initialize', () => {
    it('should initialize with API key from config', async () => {
      await geminiService.initialize();

      expect(GoogleGenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key'
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Gemini service initialized', {
        model: 'gemini-2.5-flash'
      });
    });

    it('should initialize with API key from environment variable', async () => {
      (configService.getConfig as jest.Mock).mockReturnValue({});
      process.env.GOOGLE_API_KEY = 'env-api-key';

      await geminiService.initialize();

      expect(GoogleGenAI).toHaveBeenCalledWith({
        apiKey: 'env-api-key'
      });

      delete process.env.GOOGLE_API_KEY;
    });

    it('should warn when no API key is configured', async () => {
      (configService.getConfig as jest.Mock).mockReturnValue({});

      await geminiService.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith('Gemini API key not configured');
      expect(GoogleGenAI).not.toHaveBeenCalled();
    });

    it('should throw error when initialization fails', async () => {
      (GoogleGenAI as jest.Mock).mockImplementation(() => {
        throw new Error('Init failed');
      });

      await expect(geminiService.initialize()).rejects.toThrow(CUIError);
      await expect(geminiService.initialize()).rejects.toMatchObject({
        code: 'GEMINI_INIT_ERROR',
        statusCode: 500
      });
    });
  });

  describe('checkHealth', () => {
    it('should return healthy when API is accessible', async () => {
      await geminiService.initialize();
      
      mockGenerateContent.mockResolvedValue({
        text: 'Hello response'
      });

      const result = await geminiService.checkHealth();

      expect(result).toEqual({
        status: 'healthy',
        message: 'Gemini API is accessible',
        apiKeyValid: true
      });
    });

    it('should return unhealthy when API key is not configured', async () => {
      const result = await geminiService.checkHealth();

      expect(result).toEqual({
        status: 'unhealthy',
        message: 'Gemini API key not configured',
        apiKeyValid: false
      });
    });

    it('should return unhealthy when API request fails', async () => {
      await geminiService.initialize();
      
      mockGenerateContent.mockRejectedValue(new Error('API error'));

      const result = await geminiService.checkHealth();

      expect(result).toEqual({
        status: 'unhealthy',
        message: 'API error',
        apiKeyValid: false
      });
    });
  });

  describe('transcribe', () => {
    beforeEach(async () => {
      await geminiService.initialize();
    });

    it('should successfully transcribe audio', async () => {
      const mockText = 'This is the transcribed text';
      mockGenerateContent.mockResolvedValue({
        text: mockText
      });

      const result = await geminiService.transcribe('base64audio', 'audio/wav');

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            {
              text: 'Please transcribe this audio file. Return transcribed text ONLY.'
            },
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: 'base64audio'
              }
            }
          ]
        }]
      });

      expect(result).toEqual({ text: mockText });
    });

    it('should throw error when no API key configured', async () => {
      geminiService = new GeminiService();
      
      await expect(
        geminiService.transcribe('base64audio', 'audio/wav')
      ).rejects.toThrow(CUIError);
      
      await expect(
        geminiService.transcribe('base64audio', 'audio/wav')
      ).rejects.toMatchObject({
        code: 'GEMINI_API_KEY_MISSING',
        statusCode: 400
      });
    });

    it('should throw error when transcription returns no text', async () => {
      mockGenerateContent.mockResolvedValue({
        text: ''
      });

      await expect(
        geminiService.transcribe('base64audio', 'audio/wav')
      ).rejects.toThrow(CUIError);

      await expect(
        geminiService.transcribe('base64audio', 'audio/wav')
      ).rejects.toMatchObject({
        code: 'GEMINI_TRANSCRIBE_ERROR',
        message: 'No transcription returned',
        statusCode: 500
      });
    });
  });

  describe('summarize', () => {
    beforeEach(async () => {
      await geminiService.initialize();
    });

    it('should successfully summarize text', async () => {
      const mockSummary = {
        title: 'Test Summary',
        keypoints: ['Point 1', 'Point 2', 'Point 3']
      };
      
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(mockSummary)
      });

      const result = await geminiService.summarize('Long text to summarize...');

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{
            text: 'Please summarize the following text into a title and key points:\n\nLong text to summarize...'
          }]
        }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: expect.any(Object)
        }
      });

      expect(result).toEqual(mockSummary);
    });

    it('should throw error when no API key configured', async () => {
      geminiService = new GeminiService();
      
      await expect(
        geminiService.summarize('text')
      ).rejects.toThrow(CUIError);
      
      await expect(
        geminiService.summarize('text')
      ).rejects.toMatchObject({
        code: 'GEMINI_API_KEY_MISSING',
        statusCode: 400
      });
    });

    it('should throw error when response format is invalid', async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({ invalid: 'format' })
      });

      await expect(
        geminiService.summarize('text')
      ).rejects.toThrow(CUIError);

      await expect(
        geminiService.summarize('text')
      ).rejects.toMatchObject({
        code: 'GEMINI_SUMMARIZE_ERROR',
        message: 'Invalid response format',
        statusCode: 500
      });
    });

    it('should throw error when JSON parsing fails', async () => {
      mockGenerateContent.mockResolvedValue({
        text: 'invalid json'
      });

      await expect(
        geminiService.summarize('text')
      ).rejects.toThrow(CUIError);

      await expect(
        geminiService.summarize('text')
      ).rejects.toMatchObject({
        code: 'GEMINI_SUMMARIZE_ERROR',
        statusCode: 500
      });
    });
  });
});