import {
  buildAccessTokenKey,
  getDiscoveryEndpoint,
  buildIdTokenKey,
  buildLogtoKey,
  buildRefreshTokenKey,
} from '.';

describe('browser SDK utilities', () => {
  test('build logto key', () => {
    const key = buildLogtoKey('item');
    expect(key).toEqual('logto:item');
  });

  test('build refresh token key', () => {
    const logtoKey = buildLogtoKey('clientIdValue');
    expect(buildRefreshTokenKey(logtoKey)).toEqual('logto:clientIdValue:refreshToken');
  });

  test('build id token key', () => {
    const logtoKey = buildLogtoKey('clientIdValue');
    expect(buildIdTokenKey(logtoKey)).toEqual('logto:clientIdValue:idToken');
  });

  test('get discovery endpoint', () => {
    const endpoint = getDiscoveryEndpoint('https://example.com');
    expect(endpoint).toEqual('https://example.com/oidc/.well-known/openid-configuration');
  });

  test('build access token key', () => {
    const key = buildAccessTokenKey('resource', ['scope1', 'scope2']);
    expect(key).toEqual('scope1 scope2@resource');
  });
});
