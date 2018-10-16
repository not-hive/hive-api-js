// Create Receiver class with shortcuts inheriting from Device.
var Receiver = Hive.Receiver = function (node) {
  this.initialize(node);
  this.type = 'receiver';

  this.getInfo = function () {
    return Device.getInfo(this.node);
  };

  this.getSignalStrength = function () {
    return Device.getSignalStrength(this.node);
  };
};
const ReceiverProto = Hive.Receiver.prototype = Object.create(DeviceProto);
ReceiverProto.constructor = Receiver;
