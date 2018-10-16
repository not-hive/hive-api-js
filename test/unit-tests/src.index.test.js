
const Hive = require('../../src/index');

const dist = require('../../dist/hive-home.min');
const packageJson = require('../../package.json');
const packageLockJson = require('../../package-lock.json');

const MockClient = require('./mock.axios');
const MockHive = require('./mock.hive');

describe('MockHive', () => {
  it('should be the same as Hive, only mocked', () => {
    expect(MockHive.VERSION).toBe(Hive.VERSION);
    expect(MockHive.IS_MOCK).toBe(true);
    expect(new MockHive()).toBeInstanceOf(Hive);
  });
});

describe('Hive', () => {
  it('should have the same version everywhere', () => {
    expect(Hive.VERSION).toBe(packageJson.version);
    expect(Hive.VERSION).toBe(packageLockJson.version);
    expect(Hive.VERSION).toBe(dist.VERSION);
  });

  it('should have error code constants', () => {
    expect(Hive).toHaveProperty('TIMEOUT', 'Timeout');
  });

  describe('constructor', () => {
    it('should allow injection of a client', () => {
      const hive = new Hive({ client: new MockClient() });
      expect(hive).toBeInstanceOf(Hive);
    });
  });
});
