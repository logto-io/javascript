import {
  CodeTokenResponse,
  decodeIdToken,
  fetchOidcConfig,
  fetchTokenByAuthorizationCode,
  fetchTokenByRefreshToken,
  generateCodeChallenge,
  generateCodeVerifier,
  generateSignInUri,
  generateSignOutUri,
  generateState,
  IdTokenClaims,
  Prompt,
  Requester,
  revoke,
  verifyAndParseCodeFromCallbackUri,
  verifyIdToken,
  withReservedScopes,
} from '@logto/js';
import { Nullable } from '@silverhand/essentials';
import { createRemoteJWKSet } from 'jose';
import once from 'lodash.once';
import { assert, Infer, string, type } from 'superstruct';

import { LogtoClientError } from './errors';
import { Storage } from './storage';
import { buildAccessTokenKey, getDiscoveryEndpoint } from './utils';

export type { IdTokenClaims, LogtoErrorCode, LogtoRequestErrorBody } from '@logto/js';
export { LogtoError, OidcError, Prompt, LogtoRequestError } from '@logto/js';
export * from './errors';
export type { Storage, StorageKey } from './storage';

export type LogtoConfig = {
  endpoint: string;
  appId: string;
  scopes?: string[];
  resources?: string[];
  prompt?: Prompt;
  usingPersistStorage?: boolean;
};

export type AccessToken = {
  token: string;
  scope: string;
  expiresAt: number; // Unix Timestamp in seconds
};

export const LogtoSignInSessionItemSchema = type({
  redirectUri: string(),
  codeVerifier: string(),
  state: string(),
});

export type LogtoSignInSessionItem = Infer<typeof LogtoSignInSessionItemSchema>;

export type HandleRedirect = (url: string) => void;

export default class LogtoClient {
  protected readonly logtoConfig: LogtoConfig;
  protected readonly getOidcConfig = once(this._getOidcConfig);
  protected readonly getJwtVerifyGetKey = once(this._getJwtVerifyGetKey);

  protected readonly storage: Storage;
  protected readonly requester: Requester;
  protected readonly handleRedirect: HandleRedirect;

  protected readonly accessTokenMap = new Map<string, AccessToken>();

  private readonly getAccessTokenPromiseMap = new Map<string, Promise<string>>();
  private _idToken: Nullable<string>;

  constructor(
    logtoConfig: LogtoConfig,
    {
      requester,
      storage,
      handleRedirect,
    }: { requester: Requester; storage: Storage; handleRedirect: HandleRedirect }
  ) {
    this.logtoConfig = {
      ...logtoConfig,
      prompt: logtoConfig.prompt ?? Prompt.Consent,
      scopes: withReservedScopes(logtoConfig.scopes).split(' '),
    };
    this.storage = storage;
    this.requester = requester;
    this.handleRedirect = handleRedirect;
    this._idToken = this.storage.getItem('idToken');
  }

  public get isAuthenticated() {
    return Boolean(this.idToken);
  }

  protected get signInSession(): Nullable<LogtoSignInSessionItem> {
    const jsonItem = this.storage.getItem('signInSession');

    if (!jsonItem) {
      return null;
    }

    try {
      const item: unknown = JSON.parse(jsonItem);
      assert(item, LogtoSignInSessionItemSchema);

      return item;
    } catch (error: unknown) {
      throw new LogtoClientError('sign_in_session.invalid', error);
    }
  }

  protected set signInSession(logtoSignInSessionItem: Nullable<LogtoSignInSessionItem>) {
    if (!logtoSignInSessionItem) {
      this.storage.removeItem('signInSession');

      return;
    }

    const jsonItem = JSON.stringify(logtoSignInSessionItem);
    this.storage.setItem('signInSession', jsonItem);
  }

  get refreshToken() {
    return this.storage.getItem('refreshToken');
  }

  private set refreshToken(refreshToken: Nullable<string>) {
    if (!refreshToken) {
      this.storage.removeItem('refreshToken');

      return;
    }

    this.storage.setItem('refreshToken', refreshToken);
  }

  get idToken() {
    return this._idToken;
  }

  private set idToken(idToken: Nullable<string>) {
    this._idToken = idToken;

    if (!idToken) {
      this.storage.removeItem('idToken');

      return;
    }

    this.storage.setItem('idToken', idToken);
  }

  // eslint-disable-next-line complexity
  public async getAccessToken(resource?: string): Promise<string> {
    if (!this.idToken) {
      throw new LogtoClientError('not_authenticated');
    }

    const accessTokenKey = buildAccessTokenKey(resource);
    const accessToken = this.accessTokenMap.get(accessTokenKey);

    if (accessToken && accessToken.expiresAt > Date.now() / 1000) {
      return accessToken.token;
    }

    // Since the access token has expired, delete it from the map.
    if (accessToken) {
      this.accessTokenMap.delete(accessTokenKey);
    }

    /**
     * Need to fetch a new access token using refresh token.
     * Reuse the cached promise if exists.
     */
    const cachedPromise = this.getAccessTokenPromiseMap.get(accessTokenKey);

    if (cachedPromise) {
      return cachedPromise;
    }

    /**
     * Create a new promise and cache in map to avoid race condition.
     * Since we enable "refresh token rotation" by default,
     * it will be problematic when calling multiple `getAccessToken()` closely.
     */
    const promise = this.getAccessTokenByRefreshToken(resource);
    this.getAccessTokenPromiseMap.set(accessTokenKey, promise);

    const token = await promise;
    this.getAccessTokenPromiseMap.delete(accessTokenKey);

    return token;
  }

  public getIdTokenClaims(): IdTokenClaims {
    if (!this.idToken) {
      throw new LogtoClientError('not_authenticated');
    }

    return decodeIdToken(this.idToken);
  }

  public async signIn(redirectUri: string) {
    const { appId: clientId, prompt, resources, scopes } = this.logtoConfig;
    const { authorizationEndpoint } = await this.getOidcConfig();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    const signInUri = generateSignInUri({
      authorizationEndpoint,
      clientId,
      redirectUri,
      codeChallenge,
      state,
      scopes,
      resources,
      prompt,
    });

    this.signInSession = { redirectUri, codeVerifier, state };
    this.refreshToken = null;
    this.idToken = null;

    this.handleRedirect(signInUri);
  }

  public isSignInRedirected(url: string): boolean {
    const { signInSession } = this;

    if (!signInSession) {
      return false;
    }
    const { redirectUri } = signInSession;
    const { origin, pathname } = new URL(url);

    return `${origin}${pathname}` === redirectUri;
  }

  public async handleSignInCallback(callbackUri: string) {
    const { signInSession, logtoConfig, requester } = this;

    if (!signInSession) {
      throw new LogtoClientError('sign_in_session.not_found');
    }

    const { redirectUri, state, codeVerifier } = signInSession;
    const code = verifyAndParseCodeFromCallbackUri(callbackUri, redirectUri, state);

    const { appId: clientId } = logtoConfig;
    const { tokenEndpoint } = await this.getOidcConfig();
    const codeTokenResponse = await fetchTokenByAuthorizationCode(
      {
        clientId,
        tokenEndpoint,
        redirectUri,
        codeVerifier,
        code,
      },
      requester
    );

    await this.verifyIdToken(codeTokenResponse.idToken);

    this.saveCodeToken(codeTokenResponse);
    this.signInSession = null;
  }

  public async signOut(postLogoutRedirectUri?: string) {
    if (!this.idToken) {
      throw new LogtoClientError('not_authenticated');
    }

    const { appId: clientId } = this.logtoConfig;
    const { endSessionEndpoint, revocationEndpoint } = await this.getOidcConfig();

    if (this.refreshToken) {
      try {
        await revoke(revocationEndpoint, clientId, this.refreshToken, this.requester);
      } catch {
        // Do nothing at this point, as we don't want to break the sign-out flow even if the revocation is failed
      }
    }

    const url = generateSignOutUri({
      endSessionEndpoint,
      postLogoutRedirectUri,
      idToken: this.idToken,
    });

    this.accessTokenMap.clear();
    this.refreshToken = null;
    this.idToken = null;

    this.handleRedirect(url);
  }

  private async getAccessTokenByRefreshToken(resource?: string): Promise<string> {
    if (!this.refreshToken) {
      throw new LogtoClientError('not_authenticated');
    }

    try {
      const accessTokenKey = buildAccessTokenKey(resource);
      const { appId: clientId } = this.logtoConfig;
      const { tokenEndpoint } = await this.getOidcConfig();
      const { accessToken, refreshToken, idToken, scope, expiresIn } =
        await fetchTokenByRefreshToken(
          {
            clientId,
            tokenEndpoint,
            refreshToken: this.refreshToken,
            resource,
            scopes: resource ? ['offline_access'] : undefined, // Force remove openid scope from the request
          },
          this.requester
        );

      this.accessTokenMap.set(accessTokenKey, {
        token: accessToken,
        scope,
        expiresAt: Math.round(Date.now() / 1000) + expiresIn,
      });

      this.refreshToken = refreshToken;

      if (idToken) {
        await this.verifyIdToken(idToken);
        this.idToken = idToken;
      }

      return accessToken;
    } catch (error: unknown) {
      throw new LogtoClientError('get_access_token_by_refresh_token_failed', error);
    }
  }

  private async _getOidcConfig() {
    const { endpoint } = this.logtoConfig;
    const discoveryEndpoint = getDiscoveryEndpoint(endpoint);

    return fetchOidcConfig(discoveryEndpoint, this.requester);
  }

  private async _getJwtVerifyGetKey() {
    const { jwksUri } = await this.getOidcConfig();

    return createRemoteJWKSet(new URL(jwksUri));
  }

  private async verifyIdToken(idToken: string) {
    const { appId } = this.logtoConfig;
    const { issuer } = await this.getOidcConfig();
    const jwtVerifyGetKey = await this.getJwtVerifyGetKey();

    try {
      await verifyIdToken(idToken, appId, issuer, jwtVerifyGetKey);
    } catch (error: unknown) {
      throw new LogtoClientError('invalid_id_token', error);
    }
  }

  private saveCodeToken({
    refreshToken,
    idToken,
    scope,
    accessToken,
    expiresIn,
  }: CodeTokenResponse) {
    this.refreshToken = refreshToken ?? null;
    this.idToken = idToken;

    // NOTE: Will add scope to accessTokenKey when needed. (Linear issue LOG-1589)
    const accessTokenKey = buildAccessTokenKey();
    const expiresAt = Date.now() / 1000 + expiresIn;
    this.accessTokenMap.set(accessTokenKey, { token: accessToken, scope, expiresAt });
  }
}
