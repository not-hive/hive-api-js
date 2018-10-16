
const Hive = require('../../src/index.js');
const HiveHome = require('../../dist/hive-home.min.js');
const packageJson = require('../../package.json');
const packageLockJson = require('../../package-lock.json');

describe('Hive', () => {
  it('should have the same version everywhere', () => {
    expect(Hive.VERSION).toBe(packageJson.version);
    expect(Hive.VERSION).toBe(packageLockJson.version);
    expect(Hive.VERSION).toBe(HiveHome.VERSION);
  });
});
