// Create Thermostat class with shortcuts inheriting from Device.
var Thermostat = Hive.Thermostat = function (node) {
  this.initialize(node);
  this.type = 'thermostat';

  this.getBoost = function () {
    return Device.getBoost(this.node);
  };

  this.getCurrentTemperature = function () {
    return Device.getCurrentTemperature(this.node);
  };

  this.getFrostProtectTemperature = function () {
    return Device.getFrostProtectTemperature(this.node);
  };

  this.isFrostProtect = function () {
    return Device.isFrostProtect(this.node);
  };

  this.getHeatingStatus = function () {
    return Device.getHeatingStatus(this.node);
  };

  this.getHeatingSchedule = function () {
    return Device.getHeatingSchedule(this.node);
  };

  this.getHistory = function (options) {
    return Device.getHistory(this.node, options);
  };

  this.getOnOff = function () {
    return Device.getOnOff(this.node);
  };

  this.getTargetTemperature = function () {
    return Device.getTargetTemperature(this.node);
  };

  this.setTargetTemperature = function (value) {
    const that = this;
    return Device.setTargetTemperature(this.node, value)
      .then((response) => {
        that.node = response.data.nodes[0];
        return that.getTargetTemperature();
      });
  };
};
const ThermostatProto = Thermostat.prototype = Object.create(DeviceProto);
ThermostatProto.constructor = Thermostat;
