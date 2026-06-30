import { merge } from 'lodash';
import { IPublicConfig } from './public-config.interface';
import { ISecretConfig } from './secret-config.interface';
import * as secretConfig from '../../config/secrets/config.json';
import * as devConfig from '../../config/development-config.json';
import * as prodConfig from '../../config/production-config.json';

type Environment = 'development' | 'production';
type IAppConfig = IPublicConfig &
  ISecretConfig & {
    environment: Environment;
  };

export function loadConfig(env: Environment = 'development'): IAppConfig {
  let appConfig: IPublicConfig;
  switch (env) {
    case 'production':
      appConfig = prodConfig;
      break;
    case 'development':
    default:
      appConfig = devConfig;
  }

  const allSecrets: any = secretConfig;
  const secrets: ISecretConfig = allSecrets[env] || {};
  const config = merge({}, appConfig, secrets, { environment: env });
  return config;
}

export const config = loadConfig(<Environment>process.env.NODE_ENV);
export * from './constants';
