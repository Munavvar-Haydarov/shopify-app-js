import {Request, Response} from 'express';
import {
  CallbackResponse,
  CookieNotFound,
  gdprTopics,
  InvalidOAuthError,
  LogSeverity,
  Session,
  Shopify,
} from '@shopify/shopify-api';

import {AppConfigInterface} from '../types';
import {redirectToHost} from '../redirect-to-host';
import {storage} from '../storage';

import {AfterAuthCallback, AuthCallbackParams} from './types';
import {authBegin} from './auth-begin';

export async function authCallback({
  req,
  res,
  api,
  config,
  afterAuth,
}: AuthCallbackParams) {
  try {
    const callbackResponse = await api.auth.callback({
      isOnline: config.useOnlineTokens,
      rawRequest: req,
      rawResponse: res,
    });

    storage.storeSession(callbackResponse.session);

    await afterAuthActions(req, res, api, callbackResponse, afterAuth);
  } catch (error) {
    await handleCallbackError(req, res, api, config, error);
  }
}

async function afterAuthActions(
  req: Request,
  res: Response,
  api: Shopify,
  callbackResponse: CallbackResponse,
  afterAuth?: AfterAuthCallback,
) {
  await registerWebhooks(api, callbackResponse.session);

  if (afterAuth) {
    await afterAuth({
      req,
      res,
      session: callbackResponse.session,
    });
  }

  // We redirect to the host-based app URL ONLY if the afterAuth callback didn't send a response already
  if (!res.headersSent) {
    await redirectToHost({req, res, api, session: callbackResponse.session});
  }
}

async function registerWebhooks(api: Shopify, session: Session) {
  const responsesByTopic = await api.webhooks.register(session);

  for (const topic in responsesByTopic) {
    if (!Object.prototype.hasOwnProperty.call(responsesByTopic, topic)) {
      continue;
    }

    for (const response of responsesByTopic[topic]) {
      if (!response.success && !gdprTopics.includes(topic)) {
        const result: any = response.result;

        if (result.errors) {
          await api.config.logFunction(
            LogSeverity.Error,
            `Failed to register ${topic} webhook: ${result.errors[0].message}`,
          );
        } else {
          await api.config.logFunction(
            LogSeverity.Error,
            `Failed to register ${topic} webhook: ${JSON.stringify(
              result.data,
              undefined,
              2,
            )}`,
          );
        }
      }
    }
  }
}

async function handleCallbackError(
  req: Request,
  res: Response,
  api: Shopify,
  config: AppConfigInterface,
  error: Error,
) {
  await api.config.logFunction(
    LogSeverity.Warning,
    `Failed to complete OAuth with error: ${error}`,
  );

  switch (true) {
    case error instanceof InvalidOAuthError:
      res.status(400);
      res.send(error.message);
      break;
    case error instanceof CookieNotFound:
      await authBegin({req, res, api, config});
      break;
    default:
      res.status(500);
      res.send(error.message);
      break;
  }
}
