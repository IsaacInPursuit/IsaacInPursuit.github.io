/** @jest-environment node */

function createRequest(body, headers = {}) {
  return new Request('https://example.com/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/contact integration', () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('rejects invalid email addresses without contacting upstream service', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const { POST } = require('../app/api/contact/route');

    const response = await POST(
      createRequest({
        name: 'Isaac',
        email: 'not-an-email',
        message: 'Checking validation.',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Enter a valid email address.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('enforces rate limiting per client identifier', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const { POST } = require('../app/api/contact/route');

    const headers = { 'x-forwarded-for': '203.0.113.5' };
    const validPayload = {
      name: 'Isaac',
      email: 'isaac@example.com',
      message: 'Testing rate limiting.',
    };

    for (let i = 0; i < 5; i += 1) {
      const response = await POST(createRequest(validPayload, headers));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
    }

    expect(fetchMock).toHaveBeenCalledTimes(5);

    const limitedResponse = await POST(createRequest(validPayload, headers));

    expect(limitedResponse.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(5);

    expect(limitedResponse.headers.get('Retry-After')).toBe('60');
    await expect(limitedResponse.json()).resolves.toEqual({
      error: 'Too many requests. Please wait before submitting again.',
    });

    nowSpy.mockRestore();
  });

  test('cleans up expired rate limit entries across many identifiers', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const startTime = 1_700_000_100_000;
    let currentTime = startTime;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

    const { POST, __test__ } = require('../app/api/contact/route');

    const validPayload = {
      name: 'Isaac',
      email: 'isaac@example.com',
      message: 'Testing cleanup behaviour.',
    };

    const identifiers = Array.from({ length: 20 }, (_, index) => `198.51.100.${index + 1}`);

    for (const ip of identifiers) {
      const response = await POST(createRequest(validPayload, { 'x-forwarded-for': ip }));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
    }

    expect(__test__.rateLimitStore.size).toBe(identifiers.length);

    currentTime = startTime + 60_000 + 1;

    const reusedIdentifier = identifiers[0];
    const responseAfterWindow = await POST(
      createRequest(validPayload, { 'x-forwarded-for': reusedIdentifier }),
    );

    expect(responseAfterWindow.status).toBe(200);
    await expect(responseAfterWindow.json()).resolves.toEqual({ ok: true });

    expect(__test__.rateLimitStore.size).toBe(1);
    expect(__test__.rateLimitStore.get(reusedIdentifier)?.count).toBe(1);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await POST(createRequest(validPayload, { 'x-forwarded-for': reusedIdentifier }));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
    }

    expect(__test__.rateLimitStore.get(reusedIdentifier)?.count).toBe(5);

    const limitedResponse = await POST(createRequest(validPayload, { 'x-forwarded-for': reusedIdentifier }));

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get('Retry-After')).toBe('60');
    await expect(limitedResponse.json()).resolves.toEqual({
      error: 'Too many requests. Please wait before submitting again.',
    });

    expect(fetchMock).toHaveBeenCalledTimes(identifiers.length + 5);
    expect(__test__.rateLimitStore.size).toBe(1);
    expect(__test__.rateLimitStore.has(reusedIdentifier)).toBe(true);

    __test__.rateLimitStore.clear();
    nowSpy.mockRestore();
  });
});
