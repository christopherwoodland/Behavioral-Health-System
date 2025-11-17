import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dsm5Service } from '../dsm5Service';

// Mock fetch
global.fetch = vi.fn();

describe('DSM-5 Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Data Status', () => {
    it('should check if DSM-5 data exists', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: true, count: 100 })
      });

      const status = await dsm5Service.checkDataStatus();

      expect(status.exists).toBe(true);
      expect(status.count).toBe(100);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/DSM5/Status'),
        expect.any(Object)
      );
    });

    it('should handle status check errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(dsm5Service.checkDataStatus()).rejects.toThrow('Network error');
    });

    it('should handle non-ok response for status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error'
      });

      await expect(dsm5Service.checkDataStatus()).rejects.toThrow();
    });
  });

  describe('Available Conditions', () => {
    it('should fetch available DSM-5 conditions', async () => {
      const mockConditions = [
        { id: '1', name: 'Major Depressive Disorder', code: '296.23' },
        { id: '2', name: 'Generalized Anxiety Disorder', code: '300.02' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConditions
      });

      const conditions = await dsm5Service.getAvailableConditions();

      expect(conditions).toEqual(mockConditions);
      expect(conditions).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/DSM5/Conditions'),
        expect.any(Object)
      );
    });

    it('should handle empty conditions list', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const conditions = await dsm5Service.getAvailableConditions();

      expect(conditions).toEqual([]);
    });

    it('should handle conditions fetch error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Failed to fetch'));

      await expect(dsm5Service.getAvailableConditions()).rejects.toThrow();
    });
  });

  describe('Condition Details', () => {
    it('should fetch specific condition by ID', async () => {
      const mockCondition = {
        id: '1',
        name: 'Major Depressive Disorder',
        code: '296.23',
        description: 'A mood disorder characterized by persistent sadness',
        diagnosticCriteria: ['Criterion A', 'Criterion B']
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCondition
      });

      const condition = await dsm5Service.getConditionById('1');

      expect(condition).toEqual(mockCondition);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/DSM5/Conditions/1'),
        expect.any(Object)
      );
    });

    it('should handle condition not found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(dsm5Service.getConditionById('999')).rejects.toThrow();
    });
  });

  describe('Condition Extraction', () => {
    it('should extract conditions from transcript', async () => {
      const mockExtraction = {
        conditions: ['Major Depressive Disorder', 'Anxiety Disorder'],
        confidence: 0.85
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExtraction
      });

      const transcript = 'Patient shows symptoms of depression and anxiety';
      const result = await dsm5Service.extractConditionsFromTranscript(transcript);

      expect(result).toEqual(mockExtraction);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/DSM5/ExtractConditions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining(transcript)
        })
      );
    });

    it('should handle empty transcript', async () => {
      await expect(dsm5Service.extractConditionsFromTranscript('')).rejects.toThrow();
    });

    it('should handle extraction errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Extraction failed'));

      const transcript = 'Test transcript';
      await expect(dsm5Service.extractConditionsFromTranscript(transcript)).rejects.toThrow();
    });
  });

  describe('Data Administration', () => {
    it('should upload DSM-5 data file', async () => {
      const mockResult = {
        success: true,
        recordsImported: 150
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult
      });

      const file = new File(['{"conditions": []}'], 'dsm5-data.json', { type: 'application/json' });
      const result = await dsm5Service.uploadDsm5Data(file);

      expect(result).toEqual(mockResult);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/DSM5/UploadData'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should handle upload errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      const file = new File(['invalid'], 'test.json', { type: 'application/json' });
      await expect(dsm5Service.uploadDsm5Data(file)).rejects.toThrow();
    });

    it('should delete all DSM-5 data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, deletedCount: 100 })
      });

      const result = await dsm5Service.deleteAllData();

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(100);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/DSM5/DeleteAll'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('Search and Filtering', () => {
    it('should search conditions by keyword', async () => {
      const mockResults = [
        { id: '1', name: 'Major Depressive Disorder', code: '296.23' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults
      });

      const results = await dsm5Service.searchConditions('depression');

      expect(results).toEqual(mockResults);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/DSM5/Search?query=depression'),
        expect.any(Object)
      );
    });

    it('should filter conditions by category', async () => {
      const mockResults = [
        { id: '1', name: 'Major Depressive Disorder', category: 'Mood Disorders' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults
      });

      const results = await dsm5Service.filterByCategory('Mood Disorders');

      expect(results).toEqual(mockResults);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/DSM5/FilterByCategory?category=Mood%20Disorders'),
        expect.any(Object)
      );
    });

    it('should handle search with no results', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const results = await dsm5Service.searchConditions('nonexistent');

      expect(results).toEqual([]);
    });
  });

  describe('API Configuration', () => {
    it('should use correct base URL from environment', () => {
      expect(dsm5Service.getBaseUrl()).toBeDefined();
      expect(dsm5Service.getBaseUrl()).toContain('/api/DSM5');
    });

    it('should include authorization headers when available', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: true })
      });

      await dsm5Service.checkDataStatus();

      const fetchCall = (global.fetch as any).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers).toBeDefined();
    });
  });
});
