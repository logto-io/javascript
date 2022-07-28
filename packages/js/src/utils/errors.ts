import { NormalizeKeyPaths } from '@silverhand/essentials';
import get from 'lodash.get';
import * as s from 'superstruct';

const logtoErrorCodes = Object.freeze({
  id_token: {
    invalid_iat: 'Invalid issued at time',
    invalid_token: 'Invalid token',
  },
  callback_uri_verification: {
    redirect_uri_mismatched: 'Redirect URI mismatched',
    error_found: 'Error found',
    missing_state: 'Missing state',
    state_mismatched: 'State mismatched',
    missing_code: 'Missing code',
  },
  requester: {
    not_provide_fetch: 'Should provide a fetch function under Node.js',
  },
  crypto_subtle_unavailable: 'Crypto.subtle is unavailable in insecure contexts (non-HTTPS).',
  unexpected_response_error: 'Unexpected response error from the server.',
});

export type LogtoErrorCode = NormalizeKeyPaths<typeof logtoErrorCodes>;

const getMessageByErrorCode = (errorCode: LogtoErrorCode): string => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const message = get(logtoErrorCodes, errorCode);

  if (typeof message === 'string') {
    return message;
  }

  return errorCode;
};

export class LogtoError extends Error {
  code: LogtoErrorCode;
  data: unknown;

  constructor(code: LogtoErrorCode, data?: unknown) {
    super(getMessageByErrorCode(code));
    this.code = code;
    this.data = data;
  }
}

export const logtoRequestErrorSchema = s.type({
  code: s.string(),
  message: s.string(),
});

export class LogtoRequestError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class OidcError {
  error: string;
  errorDescription?: string;

  constructor(error: string, errorDescription?: string) {
    this.error = error;
    this.errorDescription = errorDescription;
  }
}
