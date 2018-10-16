
function getReportedValue(feature, property, defaultValue) {
  if (property == null) {
    return defaultValue;
  }
  return feature && feature[property] ? feature[property].reportedValue : defaultValue;
}

function getReportedValues(feature, properties, selected, defaultValue) {
  // Create an empty object if not given one to add to.
  const reported = Object.assign({}, selected);
  const featureSetting = Object.assign({}, feature);
  Object.keys(properties).forEach((key) => {
    reported[key] = featureSetting[properties[key]]
      ? featureSetting[properties[key]].reportedValue
      : defaultValue;
  });
  return reported;
}

function parseDevicesFromNodes(nodes) {
  let device;
  const devices = {
    hubs: [],
    receivers: [],
    thermostats: [],
    thermostatUis: [],
    other: [],
  };
  const typeMapping = {
    hub: devices.hubs,
    receiver: devices.receivers,
    thermostat: devices.thermostats,
    thermostatUi: devices.thermostatUis,
  };
  for (let i = 0; i < nodes.length; i++) {
    device = Device.fromNode(nodes[i]);
    if (typeMapping[device.type]) {
      typeMapping[device.type].push(device);
    } else {
      devices.other.push(device);
    }
  }
  return devices;
}

getDevices(optionsArg) {
  const options = optionsArg || {};

  return this.getNodes(options).then((responseArg) => {
    let nodes;
    let response;
    if (options.withResponse) {
      [nodes, response] = responseArg;
    } else {
      nodes = responseArg;
    }
    const data = parseDevicesFromNodes(nodes);

    return normalizeResponse(data, response, options);
  });
}

/**
 * Implement a gerneric device.
 * @class Hive.Device
 */
const Device = function (node) {
  this.initialize(node);
  this.type = 'Device';
};

const DeviceProto = Device.prototype;

DeviceProto.initialize = function (node) {
  this.node = node;
  this.id = node.id;
  this.name = node.name;
};

DeviceProto.lastSeen = function () {
  return this.node.lastSeen;
};

DeviceProto.reload = function (options) {
  const _this = this;
  return Hive.getInstance().getNode(this.id, options)
    .then((response) => {
      _this.node = response;
      return _this;
    });
};

Device.fromNode = function (node) {
  if (!node.nodeType) {
    return new Device(node);
  } if (node.nodeType === 'http://alertme.com/schema/json/node.class.hub.json#') {
    return new Hub(node);
  } if (node.nodeType === 'http://alertme.com/schema/json/node.class.thermostatui.json#') {
    return new ThermostatUi(node);
  } if (node.nodeType === 'http://alertme.com/schema/json/node.class.thermostat.json#'
    && node.features && node.features.heating_thermostat_v1) {
    // Note the buggy use of the same nodeType for a receiver by Hive.
    return new Thermostat(node);
  } if (node.nodeType === 'http://alertme.com/schema/json/node.class.thermostat.json#') {
    return new Receiver(node);
  }
  return new Device(node);
};

// ### GET BATTERY STATUS
// * `Device.getBattery(node)`
// * `this.getBattery()`
// Gets information about the battery status for a node.
//
// Returns an object
// * `batteryLevel (string)` Percentage (without %) battery level.
// * `batteryState (string)` @TODO.
// * `batteryVoltage (string}` @TODO.
Device.getBattery = function (node) {
  const features = node.features ? node.features : {};
  return getReportedValues(features.battery_device_v1, {
    batteryLevel: 'batteryLevel',
    batteryState: 'batteryState',
    batteryVoltage: 'batteryVoltage',
  });
};

Device.getBoost = function (node) {
  const features = node.features ? node.features : {};
  let boost = getReportedValue(features.heating_thermostat_v1, 'temporaryOperatingModeOverride');
  if (boost !== 'TRANSIENT') {
    return false;
  }
  boost = getReportedValues(features.transient_mode_v1, {
    actions: 'actions',
    duration: 'duration', // seconds
    start: 'startDatetime', // ISO format e.g. 2018-02-19T15:38:49.972+0000
    end: 'endDatetime',
  });
  boost.start = boost.start && Date.parse(boost.start);
  boost.end = boost.end && Date.parse(boost.end);
  if (boost.actions[0].attribute === 'targetHeatTemperature') {
    boost.targetTemperature = Number.parseFloat(boost.actions[0].value);
  } else {
    boost.targetAttribute = boost.actions[0].attribute;
    boost.targetValue = boost.actions[0].value;
  }
  delete boost.actions;
  return boost;
};

Device.getCurrentTemperature = function (node) {
  try {
    return Number.parseFloat(node.features.temperature_sensor_v1.temperature.reportedValue);
  } catch (error) {
    return null;
  }
};

Device.getCurrentTemperatureTime = function (node) {
  try {
    return node.features.temperature_sensor_v1.temperature.reportReceivedTime;
  } catch (error) {
    return null;
  }
};

Device.getEthernetInfo = function (node) {
  const features = node.features ? node.features : {};
  return getReportedValues(features.ethernet_device_v1, {
    ipAddress: 'internalIPAddress',
    macAddress: 'macAddress',
  });
};

Device.getHistory = function (node, options) {
  return Hive.getInstance().getTimeSeriesData(node.id, options);
};

Device.getHubStatus = function (node) {
  const features = node.features ? node.features : {};
  return getReportedValues(features.hive_hub_v1, {
    state: 'devicesState', // eg UP
    server: 'serverConnectionState', // eg CONNECTED
    connection: 'connection', // eg ETHERNET
    ethernet: 'ethernetConnectionState', // eg CONNECTED
    uptime: 'uptime', // seconds
  });
};

const parseSchedule = function (setpoints) {
  const days = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
    7: 'Sun',
  };
  const schedule = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  };
  const len = setpoints.length;
  let point;
  for (let i = 0; i < len; i++) {
    point = setpoints[i];
    if (point.actions[0].value != null) {
      schedule[days[point.dayIndex]].push([point.time, point.actions[0].value]);
    } else {
      schedule[days[point.dayIndex]].push([point.time, null]);
    }
  }
  return schedule;
};

Device.getFrostProtectTemperature = function (node) {
  try {
    return Number.parseFloat(node.features.frost_protect_v1.frostProtectTemperature.reportedValue);
  } catch (error) {
    return null;
  }
};

Device.isFrostProtect = function (node) {
  return (Device.getTargetTemperature(node) === 1);
};

Device.getHeatingSchedule = function (node) {
  const features = node.features ? node.features : {};
  const reported = getReportedValue(features.heating_thermostat_v1, 'heatSchedule');
  const frostProtect = Device.getFrostProtectTemperature(node);
  let schedule;
  if (reported && reported.setpoints) {
    schedule = parseSchedule(reported.setpoints);
  }
  return {
    schedule,
    frostProtect,
  };
};

Device.getHeatingStatus = function (node) {
  const features = node.features ? node.features : {};
  const status = getReportedValues(features.heating_thermostat_v1, {
    mode: 'operatingMode', // SCHEDULE, MANUAL - set to OFF later
    isOn: 'operatingState', // HEAT, OFF
  });
  status.isOn = status.isOn === 'HEAT';
  // If the thermostat is set to OFF we need to override the reported values.
  if (getReportedValue(features.on_off_device_v1, 'mode') === 'OFF') {
    status.mode = 'OFF';
  }
  return status;
};

Device.getOnOff = function (node) {
  const features = node.features ? node.features : {};
  return getReportedValue(features.on_off_device_v1, 'mode'); // ON or OFF
};

Device.getSignalStrength = function (node) {
  const features = node.features ? node.features : {};
  return getReportedValue(features.radio_device_v1, 'signalStrength');
};

Device.getTargetTemperature = function (node) {
  try {
    // When it has just been set, .propertyStatus is PENDING and .targetValue = .displayValue =
    // the new value. .reportedValue is the OLD value.
    return Number.parseFloat(node.features.heating_thermostat_v1.targetHeatTemperature.displayValue);
  } catch (error) {
    return null;
  }
};

Device.getTemperatureUnit = function (node) {
  const features = node.features ? node.features : {};
  return getReportedValue(features.thermostat_ui_v1, 'temperatureUnit');
};

Device.getInfo = function (node) {
  const features = node.features ? node.features : {};
  return getReportedValues(features.hive_hub_v1, {
    state: 'devicesState', // eg UP
    server: 'serverConnectionState', // eg CONNECTED
    connection: 'connection', // eg ETHERNET
    ethernet: 'ethernetConnectionState', // eg CONNECTED
    uptime: 'uptime', // seconds
  });
};

Device.setTargetTemperature = function (node, value) {
  const path = `nodes/${node.id}`;
  const data = {
    nodes: [{
      features: {
        heating_thermostat_v1: {
          targetHeatTemperature: {
            targetValue: value, // value
          },
        },
      },
    }],
  };
  return Hive.getInstance().request('PUT', path, data)
    .then(response => response,
      // @TODO parse response?
    ).catch((error) => {
      // @TODO parse error?
      throw error;
    });
};

