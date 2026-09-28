import { describe, expect, it } from 'vitest';
import { resolveProxyBase } from './env';

describe('resolveProxyBase — three meanings of VITE_API_BASE_URL', () => {
  it('unset or empty means no proxy at all', () => {
    expect(resolveProxyBase(undefined)).toEqual({ base: '', configured: false });
    expect(resolveProxyBase('')).toEqual({ base: '', configured: false });
    expect(resolveProxyBase('   ')).toEqual({ base: '', configured: false });
  });

  it('"/" means the proxy is same-origin under /api (the Vercel layout)', () => {
    expect(resolveProxyBase('/')).toEqual({ base: '', configured: true });
    expect(resolveProxyBase('same-origin')).toEqual({ base: '', configured: true });
  });

  it('a full URL means a separately hosted proxy, with any trailing slash dropped', () => {
    expect(resolveProxyBase('https://proxy.example.test/')).toEqual({ base: 'https://proxy.example.test', configured: true });
  });
});
