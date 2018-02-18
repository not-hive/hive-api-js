/*!
 * Hive heating system API.
 *
 * The api is documented at https://api-prod.bgchprod.info/omnia/swagger-ui.html
 *
 * @copyright Copyright © 2018 Paul Bloomfield.
 * @license MIT.
 */

/**
 * The Hive class.
 *
 * @class
 */

var axios = require('axios')

var Hive = function () {

  var cache = {}

  // var cacheMeta = {}

  /** @var {Axios} Hive~client Axios instance. */
  var client = axios.create({
    baseURL: 'https://api-prod.bgchprod.info:443/omnia/',
    timeout: 4000,
    headers: {
      'Content-Type': 'application/vnd.alertme.zoo-6.5+json',
      'Accept': 'application/vnd.alertme.zoo-6.5+json',
      'X-Omnia-Client': 'Hive Web Dashboard',
    },
  })

  /**
   * Handle a request error.
   *
   * @function Hive~requestError
   * @param {Error} error Error thrown.
   * @return {[string, Error]} Text describing the error and the error thrown.
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
      e = getError('UNKNOWN_ERROR')
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

  /**
   * Private method to log a user in.
   *
   * @param  {object} session API response session data.
   */
  var registerSession = function (session) {
    client.defaults.headers['X-Omnia-Access-Token'] = session.sessionId
  }

  /**
   * Private method to log a user out.
   */
  var unregisterSession = function () {
    delete client.defaults.headers['X-Omnia-Access-Token']
  }

  this.getDevices = function (options) {
    options = options || {}
    var cached = cache.devices

    if (cached == null || options.flush || options.nocache) {
      return this.getNodes(options).then(function (response) {
        var devices = {}
        var nodes = options.withResponse ? response[0] : response
        var node
        for (var i = 0; i < nodes.length; i++) {
          node = nodes[i]
          if (node.name === 'Hub') {
            devices.hub = node
          } else if (node.name === 'Receiver') {
            devices.receiver = node
          } else if (node.name === 'Thermostat') {
            devices.thermostat = node
          } else if (node.name === 'Thermostat 2') {
            devices.thermostatUi = node
          } else {
            devices.other ? devices.other.push(node) : devices.other = [node]
          }
        }
        if (!options.nocache) {
          cache.devices = devices
        }
        return normalizeResponse(devices, response, options)
      })
    }
    return Promise.resolve(cached).then(function (data) {
      return normalizeResponse(data, null, options)
    })
  }

  /**
   * Make a get nodes request.
   *
   * @return {Promise} A promise for an array of nodes.
   */
  this.getNodes = function (options) {
    options = options || {}
    var cached = cache.nodes

    if (cached == null || options.flush || options.nocache) {
      return this.request('GET', 'nodes')
        .then(function (response) {
          var nodes = response.data.nodes
          if (!options.nocache) {
            cache.nodes = nodes
          }
          return normalizeResponse(nodes, response, options)
        })
    }
    return Promise.resolve(cached).then(function (data) {
      return normalizeResponse(data, null, options)
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
    return client.request(Hive.extend({
      method: method,
      url: path,
      data: data,
    }, options))
      .catch(normalizeError)
  }

  /**
   * Send a log in request and set the user to logged in if successful.
   *
   * @param  {string} username The user name (email) to log in.
   * @param  {string} password Plain text password.
   * @return {Promise} Hive request promise.
   */
  this.login = function (username, password) {
    var data = {sessions: [{
      username: username,
      password: password,
    }]}

    unregisterSession()

    return this.request('POST', 'auth/sessions', data)
      .then(function (response) {
        // Extract and normalize the data from the response.
        var session = response.data.sessions[0]
        response = [{
          userId: session.userId,
          username: session.username,
          sessionId: session.sessionId
        }, response]
        return response
      })
      .then(function (response) {
        registerSession(response[0])
        return response
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
    var path = 'auth/sessions/' + ((this.user && this.user.session) ? this.user.session.sessionId : '')
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
Hive.INVALID_LOGIN = 'Invalid login'
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

Hive.instance = null

Hive.getInstance = function () {
  if (Hive.instance == null) {
    Hive.instance = new Hive()
  }
  return Hive.instance
}

/** @var {string} Hive.VERSION Version number. */
Hive.VERSION = '0.8.0-dev'

module.exports = Hive
