import { Prompt, QueryKey } from '../consts/index.js';
import type { InteractionMode } from '../types/index.js';
import { withDefaultScopes } from '../utils/scopes.js';

const codeChallengeMethod = 'S256';
const responseType = 'code';

export type SignInUriParameters = {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scopes?: string[];
  resources?: string[];
  prompt?: Prompt | Prompt[];
  interactionMode?: InteractionMode;
  loginHint?: string;
};

const buildPrompt = (prompt?: Prompt | Prompt[]) => {
  if (Array.isArray(prompt)) {
    return prompt.join(' ');
  }

  return prompt ?? Prompt.Consent;
};

export const generateSignInUri = ({
  authorizationEndpoint,
  clientId,
  redirectUri,
  codeChallenge,
  state,
  scopes,
  resources,
  prompt,
  interactionMode,
  loginHint,
}: SignInUriParameters) => {
  const urlSearchParameters = new URLSearchParams({
    [QueryKey.ClientId]: clientId,
    [QueryKey.RedirectUri]: redirectUri,
    [QueryKey.CodeChallenge]: codeChallenge,
    [QueryKey.CodeChallengeMethod]: codeChallengeMethod,
    [QueryKey.State]: state,
    [QueryKey.ResponseType]: responseType,
    [QueryKey.Prompt]: buildPrompt(prompt),
    [QueryKey.Scope]: withDefaultScopes(scopes),
  });

  if (loginHint) {
    urlSearchParameters.append(QueryKey.LoginHint, loginHint);
  }

  for (const resource of resources ?? []) {
    urlSearchParameters.append(QueryKey.Resource, resource);
  }

  // Set interactionMode to signUp for a create account user experience
  if (interactionMode) {
    urlSearchParameters.append(QueryKey.InteractionMode, interactionMode);
  }

  return `${authorizationEndpoint}?${urlSearchParameters.toString()}`;
};
