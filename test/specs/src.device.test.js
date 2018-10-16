const Hive = require('../../dist/hive-home.min');

describe('The Device class', () => {
  it('should have a version', () => {
    expect(Device.VERSION).toBe('1.1.1');
  });
});
