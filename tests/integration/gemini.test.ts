import request from 'supertest';
import { CUIServer } from '@/cui-server';
import { geminiService } from '@/services/gemini-service';
import type { GeminiHealthResponse, GeminiTranscribeResponse, GeminiSummarizeResponse } from '@/types';

// Mock the gemini service
jest.mock('@/services/gemini-service');

describe('Gemini API Integration Tests', () => {
  let server: CUIServer;
  let authToken: string;

  beforeAll(async () => {
    // Set up test auth token
    authToken = 'test-auth-token-12345678901234567890123456789012';
    
    server = new CUIServer({
      port: 0, // Random port
      host: 'localhost',
      token: authToken
    });
    
    await server.start();
  }, 30000);

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/gemini/health', () => {
    it('should return health status when API is healthy', async () => {
      const mockHealthResponse: GeminiHealthResponse = {
        status: 'healthy',
        message: 'Gemini API is accessible',
        apiKeyValid: true
      };

      (geminiService.checkHealth as jest.Mock).mockResolvedValue(mockHealthResponse);

      const response = await request(server['app'])
        .get('/api/gemini/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual(mockHealthResponse);
      expect(geminiService.checkHealth).toHaveBeenCalledTimes(1);
    });

    it('should return unhealthy status when API key is missing', async () => {
      const mockHealthResponse: GeminiHealthResponse = {
        status: 'unhealthy',
        message: 'Gemini API key not configured',
        apiKeyValid: false
      };

      (geminiService.checkHealth as jest.Mock).mockResolvedValue(mockHealthResponse);

      const response = await request(server['app'])
        .get('/api/gemini/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual(mockHealthResponse);
    });

    it('should return 401 without auth token', async () => {
      await request(server['app'])
        .get('/api/gemini/health')
        .expect(401);
    });
  });

  describe('POST /api/gemini/transcribe', () => {
    it('should transcribe audio from file upload', async () => {
      const mockTranscribeResponse: GeminiTranscribeResponse = {
        text: 'This is the transcribed text from audio'
      };

      (geminiService.transcribe as jest.Mock).mockResolvedValue(mockTranscribeResponse);

      const response = await request(server['app'])
        .post('/api/gemini/transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', Buffer.from('fake-audio-data'), {
          filename: 'test.wav',
          contentType: 'audio/wav'
        })
        .expect(200);

      expect(response.body).toEqual(mockTranscribeResponse);
      expect(geminiService.transcribe).toHaveBeenCalledWith(
        expect.any(String), // base64 encoded
        'audio/wav'
      );
    });

    it('should transcribe audio from base64 input', async () => {
      const mockTranscribeResponse: GeminiTranscribeResponse = {
        text: 'Transcribed text from base64'
      };

      (geminiService.transcribe as jest.Mock).mockResolvedValue(mockTranscribeResponse);

      const response = await request(server['app'])
        .post('/api/gemini/transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          audio: 'base64encodedaudiodata',
          mimeType: 'audio/mp3'
        })
        .expect(200);

      expect(response.body).toEqual(mockTranscribeResponse);
      expect(geminiService.transcribe).toHaveBeenCalledWith(
        'base64encodedaudiodata',
        'audio/mp3'
      );
    });

    it('should return 400 when no audio provided', async () => {
      const response = await request(server['app'])
        .post('/api/gemini/transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'No audio provided'
      });
    });

    it('should handle service errors', async () => {
      (geminiService.transcribe as jest.Mock).mockRejectedValue(
        new Error('Transcription failed')
      );

      const response = await request(server['app'])
        .post('/api/gemini/transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          audio: 'base64audio',
          mimeType: 'audio/wav'
        })
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Transcription failed'
      });
    });
  });

  describe('POST /api/gemini/summarize', () => {
    it('should summarize text successfully', async () => {
      const mockSummarizeResponse: GeminiSummarizeResponse = {
        title: 'Meeting Summary',
        keypoints: [
          'Discussed project timeline',
          'Reviewed budget constraints',
          'Assigned action items'
        ]
      };

      (geminiService.summarize as jest.Mock).mockResolvedValue(mockSummarizeResponse);

      const response = await request(server['app'])
        .post('/api/gemini/summarize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Long meeting transcript text here...'
        })
        .expect(200);

      expect(response.body).toEqual(mockSummarizeResponse);
      expect(geminiService.summarize).toHaveBeenCalledWith(
        'Long meeting transcript text here...'
      );
    });

    it('should return 400 when no text provided', async () => {
      const response = await request(server['app'])
        .post('/api/gemini/summarize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'No text provided'
      });
    });

    it('should handle service errors', async () => {
      (geminiService.summarize as jest.Mock).mockRejectedValue(
        new Error('Summarization failed')
      );

      const response = await request(server['app'])
        .post('/api/gemini/summarize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Some text to summarize'
        })
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Summarization failed'
      });
    });

    it('should return 401 without auth token', async () => {
      await request(server['app'])
        .post('/api/gemini/summarize')
        .send({
          text: 'Some text'
        })
        .expect(401);
    });
  });
});