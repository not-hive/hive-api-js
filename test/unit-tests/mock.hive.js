
const Hive = require('../../src/index');
const MockAxios = require('./mock.axios');

class MockHive extends Hive {
  constructor() {
    super({
      client: new MockAxios(),
    });
  }
}

MockHive.IS_MOCK = true;

module.exports = MockHive;
