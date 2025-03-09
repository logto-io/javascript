import { logtoEventHandler } from '#logto';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  await logtoEventHandler(event, config);
  const accessToken = await event.context.logtoClient.getAccessToken();
  return { accessToken };
});