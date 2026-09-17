import { config } from '../src/config';

describe('Configuration Loader', () => {
  it('should load configuration from environment variables', () => {
    // This test will initially fail because we haven't implemented the config module yet
    expect(config).toBeDefined();
    expect(config.port).toBe(parseInt(process.env.PORT || '3000', 10));
    expect(config.nodeEnv).toBe(process.env.NODE_ENV || 'development');
  });
});