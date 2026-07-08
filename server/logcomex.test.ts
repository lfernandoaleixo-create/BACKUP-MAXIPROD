import { describe, it, expect } from 'vitest';

describe('Logcomex API Key Validation', () => {
  it('should have LOGCOMEX_API_KEY set', () => {
    const key = process.env.LOGCOMEX_API_KEY;
    expect(key).toBeDefined();
    expect(key).toMatch(/^ldi_/);
  });

  it('should authenticate successfully with Logcomex API', async () => {
    const key = process.env.LOGCOMEX_API_KEY;
    // Use the POST endpoint with a known container to validate the key
    const response = await fetch(
      'https://api.logcomex.ai/v1/agent-api-execute/4ea89ac8-b380-467c-8eb3-2a347704b9a2/2e7f41e6-85c4-42af-acec-fc058a77a8f1',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ container: 'TEST123', armador: 'ONE' }),
      }
    );
    // Should not get 401 (unauthorized) or 403 (forbidden)
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
    // Should get 200 (accepted/pending) since the key is valid
    const data = await response.json();
    expect(data.success).toBe(true);
  }, 30000);
});
