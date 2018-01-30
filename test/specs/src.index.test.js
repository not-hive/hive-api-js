
/* eslint-env mocha */
var chai = require("chai");
var expect = chai.expect;

var Hive = require("../../src/index.js");

describe("Hive", function () {
  "use strict";
  it("should have a version", function () {
    expect(Hive).to.have.property("VERSION");
  });
});
