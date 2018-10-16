
const Hive = require('../../src/index.js');

describe('Hive', () => {
  it('should have a version', () => {
    expect(Hive).toHaveProperty('VERSION');
  });
});
