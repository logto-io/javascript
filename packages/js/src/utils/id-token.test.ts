import { KeyObject } from 'crypto';

import { createRemoteJWKSet, generateKeyPair, SignJWT } from 'jose';
import nock from 'nock';
import { StructError } from 'superstruct';

import { LogtoError } from './errors';
import { decodeIdToken, verifyIdToken } from './id-token';

const createDefaultJwks = () => createRemoteJWKSet(new URL('https://logto.dev/oidc/jwks'));

describe('verifyIdToken', () => {
  test('valid ID Token, signed by RS256 algorithm, should not throw', async () => {
    const alg = 'RS256';
    const { privateKey, publicKey } = await generateKeyPair(alg);

    if (!(publicKey instanceof KeyObject)) {
      throw new TypeError('key is not instanceof KeyObject, check environment');
    }

    const key = publicKey.export({ format: 'jwk' });
    nock('https://logto.dev', { allowUnmocked: true })
      .get('/oidc/jwks')
      .reply(200, { keys: [key] });

    const idToken = await new SignJWT({})
      .setProtectedHeader({ alg })
      .setIssuer('foo')
      .setSubject('bar')
      .setAudience('qux')
      .setExpirationTime('2h')
      .setIssuedAt()
      .sign(privateKey);

    const jwks = createDefaultJwks();

    await expect(verifyIdToken(idToken, 'qux', 'foo', jwks)).resolves.not.toThrow();
  });

  test('valid ID Token, signed by ES512 algorithm, should not throw', async () => {
    const alg = 'ES512';
    const { privateKey, publicKey } = await generateKeyPair(alg);

    if (!(publicKey instanceof KeyObject)) {
      throw new TypeError('key is not instanceof KeyObject, check environment');
    }

    const key = publicKey.export({ format: 'jwk' });
    nock('https://logto.dev', { allowUnmocked: true })
      .get('/oidc/jwks')
      .reply(200, { keys: [key] });

    const idToken = await new SignJWT({})
      .setProtectedHeader({ alg })
      .setIssuer('foo')
      .setSubject('bar')
      .setAudience('qux')
      .setExpirationTime('2h')
      .setIssuedAt()
      .sign(privateKey);

    const jwks = createDefaultJwks();

    await expect(verifyIdToken(idToken, 'qux', 'foo', jwks)).resolves.not.toThrow();
  });

  test('mismatched signature should throw', async () => {
    const alg = 'RS256';
    const { privateKey } = await generateKeyPair(alg);
    const { publicKey } = await generateKeyPair(alg);

    if (!(publicKey instanceof KeyObject)) {
      throw new TypeError('key is not instanceof KeyObject, check envirionment');
    }

    const key = publicKey.export({ format: 'jwk' });
    nock('https://logto.dev', { allowUnmocked: true })
      .get('/oidc/jwks')
      .reply(200, { keys: [key] });

    const idToken = await new SignJWT({})
      .setProtectedHeader({ alg })
      .setIssuer('foo')
      .setSubject('bar')
      .setAudience('foz')
      .setExpirationTime('2h')
      .setIssuedAt()
      .sign(privateKey);

    const jwks = createDefaultJwks();

    await expect(verifyIdToken(idToken, 'foo', 'baz', jwks)).rejects.toThrowError(
      'signature verification failed'
    );
  });

  test('mismatched issuer should throw', async () => {
    const alg = 'RS256';
    const { privateKey, publicKey } = await generateKeyPair(alg);

    if (!(publicKey instanceof KeyObject)) {
      throw new TypeError('key is not instanceof KeyObject, check environment');
    }

    const key = publicKey.export({ format: 'jwk' });
    nock('https://logto.dev', { allowUnmocked: true })
      .get('/oidc/jwks')
      .reply(200, { keys: [key] });

    const idToken = await new SignJWT({})
      .setProtectedHeader({ alg })
      .setIssuer('foo')
      .setSubject('bar')
      .setAudience('qux')
      .setExpirationTime('2h')
      .setIssuedAt()
      .sign(privateKey);

    const jwks = createDefaultJwks();

    await expect(verifyIdToken(idToken, 'qux', 'xxx', jwks)).rejects.toThrowError(
      'unexpected "iss" claim value'
    );
  });

  test('mismatched audience should throw', async () => {
    const alg = 'RS256';
    const { privateKey, publicKey } = await generateKeyPair(alg);

    if (!(publicKey instanceof KeyObject)) {
      throw new TypeError('key is not instanceof KeyObject, check environment');
    }

    const key = publicKey.export({ format: 'jwk' });
    nock('https://logto.dev', { allowUnmocked: true })
      .get('/oidc/jwks')
      .reply(200, { keys: [key] });

    const idToken = await new SignJWT({})
      .setProtectedHeader({ alg })
      .setIssuer('foo')
      .setSubject('bar')
      .setAudience('qux')
      .setExpirationTime('2h')
      .setIssuedAt()
      .sign(privateKey);

    const jwks = createDefaultJwks();

    await expect(verifyIdToken(idToken, 'xxx', 'foo', jwks)).rejects.toThrowError(
      'unexpected "aud" claim value'
    );
  });

  test('expired ID Token should throw', async () => {
    const alg = 'RS256';
    const { privateKey, publicKey } = await generateKeyPair(alg);

    if (!(publicKey instanceof KeyObject)) {
      throw new TypeError('key is not instanceof KeyObject, check environment');
    }

    const key = publicKey.export({ format: 'jwk' });
    nock('https://logto.dev', { allowUnmocked: true })
      .get('/oidc/jwks')
      .reply(200, { keys: [key] });

    const idToken = await new SignJWT({})
      .setProtectedHeader({ alg })
      .setIssuer('foo')
      .setSubject('bar')
      .setAudience('qux')
      .setExpirationTime(Date.now() / 1000 - 1)
      .setIssuedAt()
      .sign(privateKey);

    const jwks = createDefaultJwks();

    await expect(verifyIdToken(idToken, 'qux', 'foo', jwks)).rejects.toThrowError(
      '"exp" claim timestamp check failed'
    );
  });

  test('issued at time, too far away from current time, should throw', async () => {
    const alg = 'RS256';
    const { privateKey, publicKey } = await generateKeyPair(alg);

    if (!(publicKey instanceof KeyObject)) {
      throw new TypeError('key is not instanceof KeyObject, check environment');
    }

    const key = publicKey.export({ format: 'jwk' });
    nock('https://logto.dev', { allowUnmocked: true })
      .get('/oidc/jwks')
      .reply(200, { keys: [key] });

    const idToken = await new SignJWT({})
      .setProtectedHeader({ alg })
      .setIssuer('foo')
      .setSubject('bar')
      .setAudience('qux')
      .setExpirationTime('2h')
      .setIssuedAt(Date.now() / 1000 - 180)
      .sign(privateKey);

    const jwks = createDefaultJwks();

    await expect(verifyIdToken(idToken, 'qux', 'foo', jwks)).rejects.toMatchError(
      new LogtoError('idToken.invalidIat')
    );
  });
});

describe('decodeIdToken', () => {
  test('decoding valid JWT should return claims', async () => {
    const { privateKey } = await generateKeyPair('RS256');
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('foo')
      .setSubject('bar')
      .setAudience('qux')
      .setExpirationTime(2000)
      .setIssuedAt(1000)
      .sign(privateKey);
    const idTokenClaims = decodeIdToken(jwt);
    expect(idTokenClaims).toEqual({
      iss: 'foo',
      sub: 'bar',
      aud: 'qux',
      exp: 2000,
      iat: 1000,
    });
  });

  test('decoding valid JWT with non-predefined claims should return all claims', async () => {
    const { privateKey } = await generateKeyPair('RS256');
    const payloadWithNonPredefinedClaims = { foo: 'bar' };
    const jwt = await new SignJWT(payloadWithNonPredefinedClaims)
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('foo')
      .setSubject('bar')
      .setAudience('qux')
      .setExpirationTime(2000)
      .setIssuedAt(1000)
      .sign(privateKey);
    const idTokenClaims = decodeIdToken(jwt);
    expect(idTokenClaims).toEqual({
      iss: 'foo',
      sub: 'bar',
      aud: 'qux',
      exp: 2000,
      iat: 1000,
      foo: 'bar',
    });
  });

  test('decoding invalid JWT string should throw Error', async () => {
    expect(() => decodeIdToken('invalid-JWT')).toMatchError(new LogtoError('idToken.invalidToken'));
  });

  test('decoding valid JWT without issuer should throw StructError', async () => {
    const { privateKey } = await generateKeyPair('RS256');
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('bar')
      .setAudience('qux')
      .setExpirationTime('2h')
      .setIssuedAt()
      .sign(privateKey);
    expect(() => decodeIdToken(jwt)).toThrowError(StructError);
  });

  test('decoding valid JWT without subject should throw StructError', async () => {
    const { privateKey } = await generateKeyPair('RS256');
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('foo')
      .setAudience('qux')
      .setExpirationTime('2h')
      .setIssuedAt()
      .sign(privateKey);
    expect(() => decodeIdToken(jwt)).toThrowError(StructError);
  });

  test('decoding valid JWT without audience should throw StructError', async () => {
    const { privateKey } = await generateKeyPair('RS256');
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('foo')
      .setSubject('bar')
      .setExpirationTime('2h')
      .setIssuedAt()
      .sign(privateKey);
    expect(() => decodeIdToken(jwt)).toThrowError(StructError);
  });

  test('decoding valid JWT without expiration time should throw StructError', async () => {
    const { privateKey } = await generateKeyPair('RS256');
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('foo')
      .setSubject('bar')
      .setAudience('qux')
      .setIssuedAt()
      .sign(privateKey);
    expect(() => decodeIdToken(jwt)).toThrowError(StructError);
  });

  test('decoding valid JWT without issued at time should throw StructError', async () => {
    const { privateKey } = await generateKeyPair('RS256');
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('foo')
      .setSubject('bar')
      .setAudience('qux')
      .setExpirationTime('2h')
      .sign(privateKey);
    expect(() => decodeIdToken(jwt)).toThrowError(StructError);
  });
});
