import NextStorage from './storage';
import type { NextRequestWithIronSession } from './types';

const makeRequest = (): NextRequestWithIronSession => {
  const request = {
    session: {
      save: jest.fn(),
    },
  };

  return request as unknown as NextRequestWithIronSession;
};

describe('NextStorage', () => {
  describe('Basic functions', () => {
    it('should set and get item', async () => {
      const request = makeRequest();
      const storage = new NextStorage(request);
      await storage.setItem('idToken', 'value');
      await expect(storage.getItem('idToken')).resolves.toBe('value');
    });

    it('should remove item', async () => {
      const request = makeRequest();
      const storage = new NextStorage(request);
      await storage.setItem('idToken', 'value');
      await storage.removeItem('idToken');
      await expect(storage.getItem('idToken')).resolves.toBeNull();
    });

    it('should set and get item (signInSession)', async () => {
      const request = makeRequest();
      const storage = new NextStorage(request);
      await storage.setItem('signInSession', 'value');
      await expect(storage.getItem('signInSession')).resolves.toBe('value');
    });

    it('should remove item (signInSession)', async () => {
      const request = makeRequest();
      const storage = new NextStorage(request);
      await storage.setItem('signInSession', 'value');
      await storage.removeItem('signInSession');
      await expect(storage.getItem('signInSession')).resolves.toBeNull();
    });
  });
});
