import type { GetContextParameters, LogtoConfig } from '@logto/node';
import type { SessionStorage } from '@remix-run/node';

import { makeLogtoAdapter } from './infrastructure/logto';
import { makeGetContext } from './useCases/getContext';
import { makeHandleAuthRoutes } from './useCases/handleAuthRoutes';

type Config = Readonly<LogtoConfig> & {
  readonly baseUrl: string;
};

export const makeLogtoRemix = (
  config: Config,
  deps: {
    sessionStorage: SessionStorage;
  }
) => {
  const { sessionStorage } = deps;

  const { baseUrl } = config;

  const createLogtoAdapter = makeLogtoAdapter(config);

  return Object.freeze({
    handleAuthRoutes: makeHandleAuthRoutes({
      baseUrl,
      createLogtoAdapter,
      sessionStorage,
    }),

    getContext: (dto: GetContextParameters) =>
      makeGetContext(dto, {
        createLogtoAdapter,
        sessionStorage,
      }),
  });
};

export { type LogtoContext } from '@logto/node';
