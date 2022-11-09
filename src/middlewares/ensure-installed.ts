import {Request, Response, NextFunction} from 'express';

import {redirectToAuth} from '../redirect-to-auth';
import {ApiAndConfigParams, AppConfigInterface} from '../types';
import {AppInstallations} from '../app-installations';

import {EnsureInstalledMiddleware} from './types';
import {addCSPHeader} from './csp-headers';

interface CreateEnsureInstalledParams extends ApiAndConfigParams {}

export function createEnsureInstalled({
  api,
  config,
}: CreateEnsureInstalledParams): EnsureInstalledMiddleware {
  const appInstallations = new AppInstallations(config);

  return function ensureInstalled() {
    return async (req: Request, res: Response, next: NextFunction) => {
      config.logger.info('Running ensureInstalled');

      if (!api.config.isEmbeddedApp) {
        res.status(500);
        return res.send(
          'ensureInstalled() should only be used in embedded apps; use authenticatedRequest() instead',
        );
      }

      if (typeof req.query.shop !== 'string') {
        config.logger.error(
          'ensureInstalled did not receive a shop query argument',
          {shop: req.query.shop},
        );

        res.status(500);
        return res.send('No shop provided');
      }

      const shop = api.utils.sanitizeShop(req.query.shop);

      config.logger.debug('Checking if shop has installed the app', {shop});

      if (!shop) {
        res.status(500);
        return res.send('Invalid shop provided');
      }
      const appInstalled = await appInstallations.includes(shop);

      const exitIframeRE = new RegExp(`^${config.exitIframePath}`, 'i');
      if (!appInstalled && !req.originalUrl.match(exitIframeRE)) {
        config.logger.debug(
          'App installation was not found for shop, redirecting to auth',
          {shop},
        );

        return redirectToAuth({req, res, api, config});
      }

      if (api.config.isEmbeddedApp && req.query.embedded !== '1') {
        const embeddedUrl = await api.auth.getEmbeddedAppUrl({
          rawRequest: req,
          rawResponse: res,
        });

        config.logger.debug(
          `Request is not embedded but app is. Redirecting to ${embeddedUrl} to embed the app`,
          {shop},
        );

        return res.redirect(embeddedUrl + req.path);
      }

      addCSPHeader(api, req, res);

      config.logger.info('App is installed and ready to load', {shop});

      return next();
    };
  };
}

export function createDeleteAppInstallationHandler(
  appInstallations: AppInstallations,
  config: AppConfigInterface,
) {
  return async function deleteAppInstallationHandler(
    _topic: string,
    shop: string,
    _body: any,
  ) {
    await config.logger.debug('Deleting shop sessions', {shop});

    await appInstallations.delete(shop);
  };
}
