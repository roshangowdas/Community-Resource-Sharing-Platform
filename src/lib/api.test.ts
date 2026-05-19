import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeFetch } from './api';

describe('safeFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should return data successfully when response is JSON', async () => {
    const mockData = { success: true };
    const mockResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    };
    (fetch as any).mockResolvedValue(mockResponse);

    const result = await safeFetch('/api/test');

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(mockData);
  });

  it('should return a readable error message when response is HTML (Common SPA Error)', async () => {
    const mockHtml = '<!doctype html><html><body>Error</body></html>';
    const mockResponse = {
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => mockHtml,
    };
    (fetch as any).mockResolvedValue(mockResponse);

    const result = await safeFetch('/api/missing');

    expect(result.ok).toBe(false);
    expect(result.data.error).toBe('Invalid Server Response');
    expect(result.data.message).toContain('HTML response instead of JSON');
  });

  it('should handle network failures gracefully', async () => {
    (fetch as any).mockRejectedValue(new Error('Failed to fetch'));

    const result = await safeFetch('/api/crash');

    expect(result.ok).toBe(false);
    expect(result.data.error).toBe('Network Failure');
    expect(result.data.message).toBe('Failed to fetch');
  });
});
