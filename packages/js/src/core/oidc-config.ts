import { KeysToCamelCase } from '@silverhand/essentials';
import camelcaseKeys from 'camelcase-keys';

import { Requester } from '../utils';

type OidcConfigSnakeCaseResponse = {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint: string;
  revocation_endpoint: string;
  jwks_uri: string;
  issuer: string;
};

export const discoveryPath = '/oidc/.well-known/openid-configuration';

export type OidcConfigResponse = KeysToCamelCase<OidcConfigSnakeCaseResponse>;

export const fetchOidcConfig = async (
  endpoint: string,
  requester: Requester
): Promise<OidcConfigResponse> =>
  camelcaseKeys(await requester<OidcConfigSnakeCaseResponse>(endpoint));
