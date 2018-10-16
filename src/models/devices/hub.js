// Create Hub class with shortcuts inheriting from Device.
/**
 * Implement a Hub device.
 * @class Hive.Hub
 * @extends Hive.Device
 */
var Hub = Hive.Hub = function (node) {
  this.initialize(node);
  this.type = 'hub';

  /**
   * @method Hive.Hub#getEthernetInfo
   * @return {object} Ethernet information for the Hub.
   */
  this.getEthernetInfo = function () {
    return Device.getEthernetInfo(this.node);
  };

  this.getInfo = function () {
    return Device.getInfo(this.node);
  };
};
const HubProto = Hub.prototype = Object.create(DeviceProto);
HubProto.constructor = Hub;
