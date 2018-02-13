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
var Hive = function () {
  var _this = this

  this.nodes = null
  this.user = null

  Hive.axios = require('axios')

  /**
   * @var {Axios} Hive~client Axios instance.
   */
  var client = Hive.axios.create({
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
  var requestError = function (error) {
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return [Hive.TIMEOUT, error]
      }
      if (error.message === 'Network Error') {
        return [Hive.NETWORK_ERROR, error]
      }
      return [error.message ? error.message : Hive.UNKNOWN_ERROR, error]
    }
    try {
      var code = error.response.data.errors[0].code
      if (code === 'USERNAME_PASSWORD_ERROR') {
        return [Hive.INVALID_LOGIN, error]
      }
      if (code === 'ACCOUNT_LOCKED') {
        return [Hive.ACCOUNT_LOCKED, error]
      }
      return [code, error]
    } catch (e) {
      return [Hive.UNKNOWN_ERROR, error]
    }
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
      .catch(requestError)
  }

  /**
   * Load nodes for the current user.
   *
   * @return {object} Axios request promise.
   */
  this.loadNodes = function () {
    var request = this.getNodes()

    return request.then(function (response) {
      _this.nodes = response.data.nodes
    })
  }

  /**
   * Make a get nodes request.
   *
   * @return {Promise} Axios request promise.
   */
  this.getNodes = function () {
    return this.request('GET', 'nodes')
  }

  /**
   * Private method to log a user in.
   *
   * @param  {object} session API response session data.
   */
  var registerSession = function (session) {
    _this.user = {
      id: session.userId,
      username: session.username,
      session: session,
    }
    client.defaults.headers['X-Omnia-Access-Token'] = session.sessionId
  }

  /**
   * Private method to log a user out.
   */
  var logout = function () {
    _this.user = null
    delete client.defaults.headers['X-Omnia-Access-Token']
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
    logout()

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
      logout()
    })
  }
}

/** @var {string} Hive.VERSION Version number. */
Hive.VERSION = '0.9.0-dev'

Hive.ACCOUNT_LOCKED = 'Account locked'
Hive.INVALID_LOGIN = 'Invalid login'
Hive.NETWORK_ERROR = 'Network error'
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

module.exports = Hive
