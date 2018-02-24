// # Hive heating system API.
// Copyright © 2018 Paul Bloomfield.
// MIT License.
//
// The api is documented at https://api-prod.bgchprod.info/omnia/swagger-ui.html
//
// @TODO Holiday mode.
// @TODO Changing anything!
// @TODO History.
/**
 * Hive class.
 *
 * @class Hive
*/
var Hive = function (options) {

  var _this = this

  var defaults = {
    client: 'Unidentifed app using https://github.com/not-hive/hive-api-js v' + Hive.VERSION,
  }

  var settings = Hive.extend({}, defaults, options)

  var axios = require('axios')

  /** @var {Axios} Hive~client Axios instance. */
  var client = axios.create({
    baseURL: 'https://api-prod.bgchprod.info:443/omnia/',
    timeout: 4000,
    headers: {
      'Content-Type': 'application/vnd.alertme.zoo-6.5+json',
      'Accept': 'application/vnd.alertme.zoo-6.5+json',
      'X-Omnia-Client': settings.client,
    },
  })

  /**
   * Handle a request error.
   *
   * @function Hive~requestError
   * @param {Error} error Error thrown.
   * @return {array} Text describing the error and the error thrown.
   */
  var normalizeError = function (error) {
    var getError = function (code) {
      var message
      // If the error code exists, use it, otherwise use the code as a message.
      if (Hive[code]) {
        message = Hive[code]
      } else {
        message = code
        code = 'UNKNOWN_ERROR'
      }
      // Create a new error with our own message and code, attaching the original error and
      // any Hive server errors.
      var newError = Error(message)
      newError.code = code
      newError.error = error
      if (error.response && error.response.data && error.response.data.errors) {
        newError.errors = error.response.data.errors
      } else {
        newError.errors = null
      }
      return newError
    }

    var e

    // Wrap in a try/catch block so anything unexpected is handled gracefully with an UNKNOWN_ERROR.
    try {
      // Handle responses from the Hive API.
      if (error.response) {
        if (error.response.status === 401) {
          e = getError('NOT_AUTHENTICATED')
        } else if (error.response.status === 405) {
          e = getError('METHOD_NOT_ALLOWED')
        } else {
          var code = error.response.data.errors[0].code
          if (code === 'USERNAME_PASSWORD_ERROR') {
            e = getError('INVALID_LOGIN')
          } else if (code === 'ACCOUNT_LOCKED') {
            e = getError('ACCOUNT_LOCKED')
          } else {
            e = getError(code)
          }
        }
      // There is no response, so try some more possibilities.
      } else if (error.request) {
        if (error.code === 'ECONNABORTED') {
          e = getError('TIMEOUT')
        } else if (error.message === 'Network Error') {
          e = getError('NETWORK_ERROR')
        } else {
          e = getError(error.message ? error.message : 'UNKNOWN_ERROR')
        }
      } else {
        e = getError('REQUEST_NOT_SENT')
      }
    } catch (ee) {
      e = getError(error.message ? error.message : 'UNKNOWN_ERROR')
    }
    // Now throw the error so the promise continues to be rejected.
    throw e
  }

  /**
   * Return a normalized response.
   *
   * For consistency this inner method is always used to return a (successful) response.
   *
   * @method Hive~normalizedResponse
   * @param {object} data     The properties of the requested object.
   * @param {array}  data     An array of the requested objects.
   * @param {array}  response The unmodified response from the server.
   * @param {object} settings Settings for this request.
   * @return {object|array}   Response according to the value of `settings.withResponse`.
   */
  var normalizeResponse = function (data, response, settings) {
    if (settings && settings.withResponse) {
      return [data, response]
    }
    return data
  }

  var getReportedValue = function (feature, property, defaultValue) {
    if (property == null) {
      return defaultValue
    }
    return feature && feature[property] ? feature[property].reportedValue : defaultValue
  }

  var getReportedValues = function (feature, properties, props, defaultValue) {
    // Create an empty object if not given one to add to.
    if (props == null) {
      props = {}
    }
    // If the .
    if (feature == null) {
      feature = {}
    }
    for (var key in properties) {
      props[key] = feature[properties[key]] ? feature[properties[key]].reportedValue : defaultValue
    }
    return props
  }

  /**
   * Implement a gerneric device.
   * @class Hive.Device
   */
  var Device = function (node) {
    this.initialize(node)
    this.type = 'Device'
  }

  var DeviceProto = Device.prototype

  DeviceProto.initialize = function (node) {
    this.node = node
    this.id = node.id
    this.name = node.name
  }

  DeviceProto.reload = function (options) {
    var _this = this
    return Hive.getInstance().getNode(this.id, options)
      .then(function (response) {
        _this.node = response
        return _this
      })
  }

  Device.fromNode = function (node) {
    if (!node.nodeType) {
      return new Device(node)
    } else if (node.nodeType === 'http://alertme.com/schema/json/node.class.hub.json#') {
      return new Hub(node)
    } else if (node.nodeType === 'http://alertme.com/schema/json/node.class.thermostatui.json#') {
      return new ThermostatUi(node)
    } else if (node.nodeType === 'http://alertme.com/schema/json/node.class.thermostat.json#'
      && node.features && node.features.heating_thermostat_v1) {
      // Note the buggy use of the same nodeType for a receiver by Hive.
      return new Thermostat(node)
    } else if (node.nodeType === 'http://alertme.com/schema/json/node.class.thermostat.json#') {
      return new Receiver(node)
    } else {
      return new Device(node)
    }
  }

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
    var features = node.features ? node.features : {}
    return getReportedValues(features.battery_device_v1, {
      batteryLevel: 'batteryLevel',
      batteryState: 'batteryState',
      batteryVoltage: 'batteryVoltage',
    })
  }

  Device.getBoost = function (node) {
    var features = node.features ? node.features : {}
    var boost = getReportedValue(features.heating_thermostat_v1, 'temporaryOperatingModeOverride')
    if (boost !== 'TRANSIENT') {
      return false
    }
    boost = getReportedValues(features.transient_mode_v1, {
      actions: 'actions',
      duration: 'duration', // seconds
      startDateTime: 'startDateTime', // ISO format e.g. 2018-02-19T15:38:49.972+0000
      endDateTime: 'endDateTime',
    })
    if (boost.actions[0].attribute === 'targetHeatTemperature') {
      boost.targetTemperature = boost.actions[0].value
    } else {
      boost.targetAttribute = boost.actions[0].attribute
      boost.targetValue = boost.actions[0].value
    }
    delete boost.actions
    return boost
  }

  Device.getCurrentTemperature = function (node) {
    var report = node && node.features && node.features.temperature_sensor_v1
      && node.features.temperature_sensor_v1.temperature
    if (report) {
      return {
        value: report.reportedValue,
        time: report.reportReceivedTime,
      }
    }
    return {}
  }

  Device.getEthernetInfo = function (node) {
    var features = node.features ? node.features : {}
    return getReportedValues(features.ethernet_device_v1, {
      ipAddress: 'internalIPAddress',
      macAddress: 'macAddress',
    })
  }

  Device.getHistory = function (node, options) {
    return Hive.getInstance().getTimeSeriesData(node.id, options)
  }

  Device.getHubStatus = function (node) {
    var features = node.features ? node.features : {}
    return getReportedValues(features.hive_hub_v1, {
      state: 'devicesState', // eg UP
      server: 'serverConnectionState', // eg CONNECTED
      connection: 'connection', // eg ETHERNET
      ethernet: 'ethernetConnectionState', // eg CONNECTED
      uptime: 'uptime', // seconds
    })
  }

  var parseSchedule = function (setpoints) {
    var days = {
      1: 'Mon',
      2: 'Tue',
      3: 'Wed',
      4: 'Thu',
      5: 'Fri',
      6: 'Sat',
      7: 'Sun',
    }
    var schedule = {
      Mon: [],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: [],
      Sat: [],
      Sun: [],
    }
    var len = setpoints.length
    var point
    for (var i = 0; i < len; i++) {
      point = setpoints[i]
      if (point.actions[0].value != null) {
        schedule[days[point.dayIndex]].push([point.time, point.actions[0].value])
      } else {
        schedule[days[point.dayIndex]].push([point.time, null])
      }
    }
    return schedule
  }

  Device.getFrostProtectTemperature = function (node) {
    var features = node.features ? node.features : {}
    return getReportedValue(features.frost_protect_v1, 'frostProtectTemperature')
  }

  Device.getHeatingSchedule = function (node) {
    var features = node.features ? node.features : {}
    var reported = getReportedValue(features.heating_thermostat_v1, 'heatSchedule')
    var frostProtect = Device.getFrostProtectTemperature(node)
    var schedule
    if (reported && reported.setpoints) {
      schedule = parseSchedule(reported.setpoints)
    }
    return {
      schedule: schedule,
      frostProtect: frostProtect,
    }
  }

  Device.getHeatingStatus = function (node) {
    var features = node.features ? node.features : {}
    var status = getReportedValues(features.heating_thermostat_v1, {
      mode: 'operatingMode', // SCHEDULE, MANUAL - set to OFF later
      isOn: 'operatingState', // HEAT, OFF
      targetTemperature: 'targetHeatTemperature',
    })
    status.isOn = status.isOn === 'HEAT'
    // If the thermostat is set to OFF we need to override the reported values.
    if (getReportedValue(features.on_off_device_v1, 'mode') === 'OFF') {
      status.mode = 'OFF'
      status.targetTemperature = Device.getFrostProtectTemperature(node)
    }
    return status
  }

  Device.getOnOff = function (node) {
    var features = node.features ? node.features : {}
    return getReportedValue(features.on_off_device_v1, 'mode') // ON or OFF
  }

  Device.getSignalStrength = function (node) {
    var features = node.features ? node.features : {}
    return getReportedValue(features.radio_device_v1, 'signalStrength')
  }

  Device.getTemperatureUnit = function (node) {
    var features = node.features ? node.features : {}
    return getReportedValue(features.thermostat_ui_v1, 'temperatureUnit')
  }

  Device.getInfo = function (node) {
    var features = node.features ? node.features : {}
    return getReportedValues(features.hive_hub_v1, {
      state: 'devicesState', // eg UP
      server: 'serverConnectionState', // eg CONNECTED
      connection: 'connection', // eg ETHERNET
      ethernet: 'ethernetConnectionState', // eg CONNECTED
      uptime: 'uptime', // seconds
    })
  }

  Device.setTargetTemperature = function (node, value) {
    var path = 'nodes/' + node.id
    var data = {
      nodes: [{
        features: {
          heating_thermostat_v1: {
            targetHeatTemperature: {
              targetValue: value // value
            }
          }
        }
      }]
    }
    return Hive.getInstance().request('PUT', path, data)
      .then(function (response) {
        // @TODO parse response?
      }).catch(function (error) {
        // @TODO parse error?
        throw error
      })
  }

  // Create Hub class with shortcuts inheriting from Device.
  /**
   * Implement a Hub device.
   * @class Hive.Hub
   * @extends Hive.Device
   */
  var Hub = Hive.Hub = function (node) {
    this.initialize(node)
    this.type = 'hub'

    /**
     * @method Hive.Hub#getEthernetInfo
     * @return {object} Ethernet information for the Hub.
     */
    this.getEthernetInfo = function () {
      return Device.getEthernetInfo(this.node)
    }

    this.getInfo = function () {
      return Device.getInfo(this.node)
    }

  }
  var HubProto = Hub.prototype = Object.create(DeviceProto)
  HubProto.constructor = Hub

  // Create Thermostat class with shortcuts inheriting from Device.
  var Thermostat = Hive.Thermostat = function (node) {
    this.initialize(node)
    this.type = 'thermostat'

    this.getBoost = function () {
      return Device.getBoost(this.node)
    }

    this.getCurrentTemperature = function () {
      return Device.getCurrentTemperature(this.node)
    }

    this.getHeatingStatus = function () {
      return Device.getHeatingStatus(this.node)
    }

    this.getHeatingSchedule = function () {
      return Device.getHeatingSchedule(this.node)
    }

    this.getHistory = function (options) {
      return Device.getHistory(this.node, options)
    }

    this.getOnOff = function () {
      return Device.getOnOff(this.node)
    }

    this.setTargetTemperature = function (value) {
      return Device.setTargetTemperature(this.node, value)
    }

  }
  var ThermostatProto = Thermostat.prototype = Object.create(DeviceProto)
  ThermostatProto.constructor = Thermostat

  // Create ThermostatUi class with shortcuts inheriting from Device.
  var ThermostatUi = Hive.ThermostatUi = function (node) {
    this.initialize(node)
    this.type = 'thermostatUi'

    this.getBattery = function () {
      return Device.getBattery(this.node)
    }

    this.getSignalStrength = function () {
      return Device.getSignalStrength(this.node)
    }

    this.getInfo = function () {
      return Device.getInfo(this.node)
    }

    this.getTemperatureUnit = function () {
      return Device.getTemperatureUnit(this.node)
    }

  }
  var ThermostatUiProto = Hive.ThermostatUi.prototype = Object.create(DeviceProto)
  ThermostatUiProto.constructor = ThermostatUi

  // Create Receiver class with shortcuts inheriting from Device.
  var Receiver = Hive.Receiver = function (node) {
    this.initialize(node)
    this.type = 'receiver'

    this.getInfo = function () {
      return Device.getInfo(this.node)
    }

    this.getSignalStrength = function () {
      return Device.getSignalStrength(this.node)
    }
  }
  var ReceiverProto = Hive.Receiver.prototype = Object.create(DeviceProto)
  ReceiverProto.constructor = Receiver

  var parseDevicesFromNodes = function (nodes) {
    var device
    var devices = {
      hubs: [],
      receivers: [],
      thermostats: [],
      thermostatUis: [],
      other: [],
    }
    var typeMapping = {
      hub: devices.hubs,
      receiver: devices.receivers,
      thermostat: devices.thermostats,
      thermostatUi: devices.thermostatUis,
    }
    for (var i = 0; i < nodes.length; i++) {
      device = Device.fromNode(nodes[i])
      if (typeMapping[device.type]) {
        typeMapping[device.type].push(device)
      } else {
        devices.other.push(device)
      }
    }
    return devices
  }

  /**
   * Private method to log a user in.
   *
   * @param  {object} session API response session data.
   */
  var registerSession = function (user) {
    client.defaults.headers['X-Omnia-Access-Token'] = user.sessionId
  }

  /**
   * Private method to log a user out.
   */
  var unregisterSession = function () {
    delete client.defaults.headers['X-Omnia-Access-Token']
  }

  this.getDevices = function (options) {
    options = options || {}

    return this.getNodes(options).then(function (response) {
      var nodes
      if (options.withResponse) {
        nodes = response[0]
        response = response[1]
      } else {
        nodes = response
      }
      var data = parseDevicesFromNodes(nodes)

      return normalizeResponse(data, response, options)
    })
  }

  /**
   * Make a get node request.
   *
   * @return {Promise} A promise for a node.
   */
  this.getNode = function (id, options) {
    options = options || {}

    var params = {}

    options.fields && (params.fields = options.fields)

    return this.request('GET', 'nodes/' + id, params)
      .then(function (response) {
        var data = response.data.nodes[0]
        return normalizeResponse(data, response, options)
      })
  }

  /**
   * Make a get nodes request.
   *
   * @return {Promise} A promise for an array of nodes.
   */
  this.getNodes = function (options) {
    options = options || {}

    return this.request('GET', 'nodes')
      .then(function (response) {
        var data = response.data.nodes
        return normalizeResponse(data, response, options)
      })
  }

  /**
   * Make a get channels request.
   *
   * @return {Promise} A promise for an array of channels.
   */
  this.getTimeSeries = function (options) {
    options = options || {}

    return this.request('GET', 'channels')
      .then(function (response) {
        var data = response.data.channels
        return normalizeResponse(data, response, options)
      })
  }

  /**
   * Make a get channels request.
   *
   * @return {Promise} A promise for an array of channels.
   */
  this.getEvents = function (options) {
    options = options || {}

    var params = {}

    if (options.limitPerDevice) {
      params.limitPerDevice = options.limitPerDevice
    } else if (options.limit) {
      params.limit = options.limit
    } else {
      params.limitPerDevice = 100
    }

    options.from && (params.fromTime = options.from)
    options.to && (params.toTime = options.to)
    options.nodes && (params.source = options.nodes)

    return this.request('GET', 'events', params, options)
      .then(function (response) {
        var data = response.data.events
        return normalizeResponse(data, response, options)
      })
  }

  /**
   * Make a get channels request.
   *
   * @return {Promise} A promise for an array of channels.
   */
  this.getTimeSeriesData = function (nodeId, options) {
    options = options || {}

    var params = {
      start: options.from ? options.from : Date.now() - 60000 * 60, // 1 hour
      timeUnit: options.unit ? options.unit : 'SECONDS',
      rate: options.interval ? options.interval : 1,
      operation: options.value ? options.value : 'AVG',
    }

    var type = options.type ? options.type : 'temperature'
    var channelId = type + '@' + nodeId
    return this.request('GET', 'channels/' + channelId, params, options)
      .then(function (response) {
        var data = response.data.channels
        return normalizeResponse(data, response, options)
      })
  }

  /**
   * Send a request to the Hive API.
   *
   * @param {string} method The HTTP method.
   * @param {string} path The path (relative to the base URL set for the client).
   * @param {object} data Key-value pairs to be sent as JSON data (or URL-encoded for GET request).
   * @param {object} options Options to set or override for this request.
   * @return {Promise} Axios request promise chain.
   */
  this.request = function (method, path, data, options) {
    var settings = {
      method: method,
      url: path,
    }
    if (data != null) {
      if (method.toUpperCase() === 'GET') {
        settings.params = data
      } else {
        settings.data = data
      }
    }
    return client.request(Hive.extend(settings, options))
      .catch(normalizeError)
  }

  /**
   * Send a log in request and set the user to logged in if successful.
   *
   * @param  {string} username The user name (email) to log in.
   * @param  {string} password Plain text password.
   * @param  {object} options  Request options.
   * @return {Promise} Hive request promise.
   */
  this.login = function (username, password, options) {
    var data = {sessions: [{
      username: username,
      password: password,
    }]}

    unregisterSession()

    return this.request('POST', 'auth/sessions', data)
      .then(function (response) {
        var user = response.data.sessions[0]
        registerSession(user)
        _this.user = user
        return normalizeResponse(user, response, options)
      })
      /* eslint handle-callback-err:0 */
      .catch(function (error) {
        // @REVISIT move the login specific error handling here?
        throw error
      })
  }

  /**
   * Send a log out request and set the user to logged out.
   */
  this.logout = function () {
    var path = 'auth/sessions/' + ((this.user) ? this.user.sessionId : '')
    return this.request('DELETE', path, null, {
      validateStatus: function (status) {
        // treat Unauthorized etc. as successful
        return status === 200 || status === 400 || status === 401 || status === 403
      }
    }).then(function () {
      unregisterSession()
    }).catch(function (error) {
      unregisterSession()
      throw error
    })
  }
}

Hive.ACCOUNT_LOCKED = 'Account locked'
Hive.NOT_PERMITTED = 'Not permitted'
Hive.INVALID_LOGIN = 'Invalid login'
Hive.METHOD_NOT_ALLOWED = 'Method not allowed'
Hive.NETWORK_ERROR = 'Network error'
Hive.NOT_AUTHENTICATED = 'Not authenticated'
Hive.REQUEST_NOT_SENT = 'Request not sent'
Hive.TIMEOUT = 'Timeout'
Hive.UNKNOWN_ERROR = 'Unknown error'

/** @function Hive.extend() Simple object extension. */
Hive.extend = function () {
  var options
  var name
  var target = arguments[0] || {}

  for (var i = 1; i < arguments.length; i++) {
    // Only deal with non-null/undefined values
    if ((options = arguments[i]) != null) {
      // Extend the base object
      for (name in options) {
        target[name] = options[name]
      }
    }
  }
  return target
}

var instance

Hive.getInstance = function (options) {
  if (instance == null) {
    instance = new Hive(options)
  }
  return instance
}

/** @var {string} Hive.VERSION Version number. */
Hive.VERSION = '0.8.0-dev'

if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = Hive
  }
  exports.Hive = Hive
} else {
  window.Hive = Hive
}
