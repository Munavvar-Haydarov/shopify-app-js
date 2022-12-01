import {
  ConfigParams as ApiConfigParams,
  Session,
  Shopify,
  ShopifyRestResources,
} from '@shopify/shopify-api';
import {SessionStorage} from '@shopify/shopify-app-session-storage';
import {Request, Response} from 'express';

export interface AppConfigParams<
  R extends ShopifyRestResources = any,
  S extends SessionStorage = SessionStorage,
> {
  api?: Partial<ApiConfigParams<R>>;
  useOnlineTokens?: boolean;
  exitIframePath?: string;
  auth?: Partial<AuthConfigInterface>;
  webhooks?: Partial<WebhooksConfigInterface>;
  sessionStorage?: S;
}

export interface AppConfigInterface<
  R extends ShopifyRestResources = any,
  S extends SessionStorage = SessionStorage,
> extends Omit<AppConfigParams<R, S>, 'api'> {
  logger: Shopify['logger'];
  useOnlineTokens: boolean;
  exitIframePath: string;
  auth: AuthConfigInterface;
  webhooks: WebhooksConfigInterface;
  sessionStorage: S;
}

export interface AfterAuthCallbackParams {
  req: Request;
  res: Response;
  session: Session;
}
export type AfterAuthCallback = (
  params: AfterAuthCallbackParams,
) => void | Promise<void>;

export interface AuthConfigInterface {
  path: string;
  callbackPath: string;
  afterAuth?: AfterAuthCallback;
  checkBillingPlans?: string[];
}

export interface WebhooksConfigInterface {
  path: string;
}
