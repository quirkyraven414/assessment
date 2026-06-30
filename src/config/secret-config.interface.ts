export interface ISecretConfig {
  database?: {
    password?: string;
  };
  redis?: {
    password?: string;
  };
  opensearch?: {
    username?: string;
    password?: string;
  };
}
