import { defineNuxtModule, addServerHandler, addImportsDir, createResolver } from '@nuxt/kit';
import { defu } from 'defu';
import { type NuxtModule } from 'nuxt/schema';

import { defaults } from './runtime/utils/constants';
import { type LogtoRuntimeConfig, type LogtoRuntimeConfigInput } from './runtime/utils/types';

// This will not export the default export
export * from '@logto/node';
export { default as LogtoNodeClient } from '@logto/node';
export * from './runtime/utils/types';
export * from './runtime/utils/constants';
export * from './runtime/utils/handler';

const logtoModule: NuxtModule<LogtoRuntimeConfigInput> = defineNuxtModule<LogtoRuntimeConfigInput>({
  meta: {
    name: '@logto/nuxt',
    configKey: 'logto',
  },
  defaults,
  setup(options, nuxt) {
    // Merge runtimeConfig with module options (options already merged with defaults)
    const runtimeConfig = defu<LogtoRuntimeConfig, LogtoRuntimeConfigInput[]>(
      // eslint-disable-next-line no-restricted-syntax
      nuxt.options.runtimeConfig.logto as LogtoRuntimeConfig,
      options,
      {
        fetchUserInfo: false,
        postCallbackRedirectUri: '/',
        postLogoutRedirectUri: '/',
        pathnames: {
          signIn: '/sign-in',
          signOut: '/sign-out',
          callback: '/callback',
        },
      } satisfies LogtoRuntimeConfigInput
    );

    // eslint-disable-next-line @silverhand/fp/no-mutation
    nuxt.options.runtimeConfig.logto = runtimeConfig;

    const { resolve } = createResolver(import.meta.url);

    addServerHandler({
      handler: resolve('./runtime/server/event-handler'),
    });

    addImportsDir(resolve('./runtime/composables'));

    nuxt.hook('nitro:config', (nitroConfig) => {
      // eslint-disable-next-line @silverhand/fp/no-mutation
      nitroConfig.alias ||= {};
      // eslint-disable-next-line @silverhand/fp/no-mutation
      nitroConfig.alias['#logto'] = resolve('./runtime/utils/handler.js');
    });
  },
});

export default logtoModule;
