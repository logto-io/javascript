import LogtoClient from '@logto/browser';
import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';

import { LogtoContext, type LogtoContextProps } from '../context.js';
import { LogtoProvider } from '../provider.js';

import { useHandleSignInCallback, useLogto } from './index.js';

const isAuthenticated = jest.fn(() => false);
const isSignInRedirected = jest.fn(() => false);
const handleSignInCallback = jest.fn().mockResolvedValue(undefined);
const getAccessToken = jest.fn(() => {
  throw new Error('not authenticated');
});

const notImplemented = () => {
  throw new Error('Not implemented');
};

jest.mock('@logto/browser', () => {
  return jest.fn().mockImplementation(() => {
    return {
      isAuthenticated,
      isSignInRedirected,
      handleSignInCallback,
      getAccessToken,
      signIn: jest.fn().mockResolvedValue(undefined),
      signOut: jest.fn().mockResolvedValue(undefined),
    };
  });
});

const endpoint = 'https://logto.dev';
const appId = 'foo';

const createHookWrapper =
  () =>
  ({ children }: { children?: ReactNode }) =>
    <LogtoProvider config={{ endpoint, appId }}>{children}</LogtoProvider>;

describe('useLogto', () => {
  it('should throw without using context provider', () => {
    expect(() => renderHook(useLogto)).toThrow();
  });

  it('should call LogtoClient constructor on init', async () => {
    await act(async () => {
      renderHook(useLogto, {
        wrapper: createHookWrapper(),
      });
    });

    expect(LogtoClient).toHaveBeenCalledWith({ endpoint, appId });
  });

  it('should return LogtoClient property methods', async () => {
    const { result } = renderHook(useLogto, {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      const { signIn, signOut, fetchUserInfo, getAccessToken, getIdTokenClaims, error } =
        result.current;

      expect(error).toBeUndefined();
      expect(signIn).not.toBeUndefined();
      expect(signOut).not.toBeUndefined();
      expect(fetchUserInfo).not.toBeUndefined();
      expect(getAccessToken).not.toBeUndefined();
      expect(getIdTokenClaims).not.toBeUndefined();
    });
  });

  it('should not call `handleSignInCallback` when it is not in callback url', async () => {
    await act(async () => {
      renderHook(useHandleSignInCallback, {
        wrapper: createHookWrapper(),
      });
    });
    expect(handleSignInCallback).not.toHaveBeenCalled();
  });

  it('should not call `handleSignInCallback` when it is authenticated', async () => {
    const mockClient = new LogtoClient({ endpoint, appId });
    const mockContext: LogtoContextProps = {
      logtoClient: mockClient,
      isAuthenticated: true, // Mock this to true by default
      loadingCount: 1,
      setIsAuthenticated: notImplemented,
      setLoadingCount: notImplemented,
      setError: notImplemented,
    };

    isSignInRedirected.mockReturnValueOnce(true);
    isAuthenticated.mockReturnValueOnce(true);

    await act(async () => {
      renderHook(useHandleSignInCallback, {
        wrapper: ({ children }: { children?: ReactNode }) => (
          <LogtoContext.Provider value={mockContext}>{children}</LogtoContext.Provider>
        ),
      });
    });

    expect(handleSignInCallback).not.toHaveBeenCalled();
  });

  it('should call `handleSignInCallback` when navigated back to predefined callback url', async () => {
    isSignInRedirected.mockReturnValueOnce(true);

    const { result } = renderHook(useHandleSignInCallback, {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
    expect(handleSignInCallback).toHaveBeenCalledTimes(1);
    handleSignInCallback.mockRestore();
  });

  it('should call `handleSignInCallback` only once even if it fails internally', async () => {
    isSignInRedirected.mockReturnValueOnce(true);
    handleSignInCallback.mockRejectedValueOnce(new Error('Oops'));

    const { result } = renderHook(useHandleSignInCallback, {
      wrapper: createHookWrapper(),
    });
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });
    expect(handleSignInCallback).toHaveBeenCalledTimes(1);
  });

  it('should return error when getAccessToken fails', async () => {
    const { result } = renderHook(useLogto, {
      wrapper: createHookWrapper(),
    });

    await act(async () => {
      await result.current.getAccessToken();
    });
    await waitFor(() => {
      expect(result.current.error).not.toBeUndefined();
      expect(result.current.error?.message).toBe('not authenticated');
    });
  });
});
