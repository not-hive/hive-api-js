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

const axios = require('axios');

/** @var {string} version Version number. */
const VERSION = '1.2.0-dev';

const errorCodes = {
  ACCOUNT_LOCKED: 'Account locked',
  BAD_REQUEST: 'Bad request',
  NOT_PERMITTED: 'Not permitted',
  INVALID_LOGIN: 'Invalid login',
  METHOD_NOT_ALLOWED: 'Method not allowed',
  NETWORK_ERROR: 'Network error',
  NOT_AUTHENTICATED: 'Not authenticated',
  REQUEST_NOT_SENT: 'Request not sent',
  TIMEOUT: 'Timeout',
  UNKNOWN_ERROR: 'Unknown error',
};

const hiveDefaults = {
  clientHeader: `Unidentifed app using https://github.com/not-hive/hive-api-js v${VERSION}`,
};

let hiveSettings;

/**
 * Handle a request error.
 *
 * @function Hive~requestError
 * @param {Error} error Error thrown.
 * @return {array} Text describing the error and the error thrown.
 */
function normalizeError(error) {
  function getError(errorCode) {
    let code = errorCode;
    let message;
    // If the error code exists, use it, otherwise use the code as a message.
    if (errorCodes[code]) {
      message = errorCodes[code];
    } else {
      message = code;
      code = 'UNKNOWN_ERROR';
    }
    // Create a new error with our own message and code, attaching the original error and
    // any Hive server errors.
    const newError = Error(message);
    newError.code = code;
    newError.error = error;
    if (error.response && error.response.data && error.response.data.errors) {
      newError.errors = error.response.data.errors;
    } else {
      newError.errors = null;
    }
    return newError;
  }

  let e;

  // Wrap in a try/catch block so anything unexpected is handled gracefully with an UNKNOWN_ERROR.
  try {
    // Handle responses from the Hive API.
    if (error.response) {
      if (error.response.status === 401) {
        e = getError('NOT_AUTHENTICATED');
      } else if (error.response.status === 400) {
        e = getError('BAD_REQUEST');
      } else if (error.response.status === 405) {
        e = getError('METHOD_NOT_ALLOWED');
      } else {
        const { code } = error.response.data.errors[0].code;
        if (code === 'USERNAME_PASSWORD_ERROR') {
          e = getError('INVALID_LOGIN');
        } else if (code === 'ACCOUNT_LOCKED') {
          e = getError('ACCOUNT_LOCKED');
        } else {
          e = getError(code);
        }
      }
    // There is no response, so try some more possibilities.
    } else if (error.request) {
      if (error.code === 'ECONNABORTED') {
        e = getError('TIMEOUT');
      } else if (error.message === 'Network Error') {
        e = getError('NETWORK_ERROR');
      } else {
        e = getError(error.message ? error.message : 'UNKNOWN_ERROR');
      }
    } else {
      e = getError('REQUEST_NOT_SENT');
    }
  } catch (ee) {
    e = getError(error.message ? error.message : 'UNKNOWN_ERROR');
  }
  // Now throw the error so the promise continues to be rejected.
  throw e;
}

// # `Hive`
// Valid options:
// | key      | description                                       |
// | ---------| ------------------------------------------------- |
// | `client` | A (mock) client implementing the Axios interface. |
//
class Hive {
  constructor(options) {
    hiveSettings = Object.assign({}, hiveDefaults, options);

    // Use a supplied client or get a client instance.
    if (hiveSettings.client) {
      this.client = hiveSettings.client;
    } else {
      this.client = axios.create({
        baseURL: 'https://api-prod.bgchprod.info:443/omnia/',
        timeout: 4000,
        headers: {
          'Content-Type': 'application/vnd.alertme.zoo-6.6+json',
          Accept: 'application/vnd.alertme.zoo-6.6+json',
          'X-Omnia-Client': hiveSettings.clientHeader,
        },
      });
    }
  }

  /**
   * Send a request to the Hive API.
   *
   * @param {string} method The HTTP method.
   * @param {string} url The path (relative to the base URL set for the client).
   * @param {object} data Key-value pairs to be sent as JSON data (or URL-encoded for GET request).
   * @param {object} options Options to set or override for this request.
   * @return {Promise} Axios request promise chain.
   */
  request(method, url, data, options) {
    const requestSettings = Object.assign({
      method,
      url,
    }, options);
    if (data != null) {
      if (method.toUpperCase() === 'GET') {
        requestSettings.params = data;
      } else {
        requestSettings.data = data;
      }
    }
    return this.client.request(requestSettings)
      .catch(normalizeError);
  }

  /**
   * Make a get node request.
   *
   * @return {Promise} A promise for a node.
   */
  getNode(id, optionsArg) {
    const options = optionsArg || {};

    const params = {};

    if (options.fields) {
      params.fields = options.fields;
    }

    return this.request('GET', `nodes/${id}`, params)
      .then((response) => {
        const data = response.data.nodes[0];
        return this.normalizeResponse(data, response, options);
      });
  }

  /**
   * Make a get nodes request.
   *
   * @return {Promise} A promise for an array of nodes.
   */
  getNodes(optionsArg) {
    const options = optionsArg || {};

    return this.request('GET', 'nodes')
      .then((response) => {
        const data = response.data.nodes;
        return this.normalizeResponse(data, response, options);
      });
  }

  /**
   * Make a get channels request.
   *
   * @return {Promise} A promise for an array of channels.
   */
  getTimeSeries(optionsArg) {
    const options = optionsArg || {};

    return this.request('GET', 'channels')
      .then((response) => {
        const data = response.data.channels;
        return this.normalizeResponse(data, response, options);
      });
  }

  /**
   * Make a get channels request.
   *
   * @return {Promise} A promise for an array of channels.
   */
  getEvents(optionsArg) {
    const options = optionsArg || {};

    const params = {};

    if (options.limitPerDevice) {
      params.limitPerDevice = options.limitPerDevice;
    } else if (options.limit) {
      params.limit = options.limit;
    } else {
      params.limitPerDevice = 100;
    }

    if (options.from) {
      params.fromTime = options.from;
    }
    if (options.to) {
      params.toTime = options.to;
    }
    if (options.nodes) {
      params.source = options.nodes;
    }

    return this.request('GET', 'events', params, options)
      .then((response) => {
        const data = response.data.events;
        return this.normalizeResponse(data, response, options);
      });
  }

  /**
   * Make a get channels request.
   *
   * @return {Promise} A promise for an array of channels.
   */
  getTimeSeriesData(nodeId, optionsArg) {
    const options = optionsArg || {};

    const params = {
      start: options.from ? options.from : Date.now() - 60000 * 60, // 1 hour
      timeUnit: options.unit ? options.unit : 'SECONDS',
      rate: options.interval ? options.interval : 1,
      operation: options.value ? options.value : 'AVG',
    };

    params.end = options.to || params.start + 60000 * 60 * 24; // 1 day

    const type = options.type ? options.type : 'temperature';
    const channelId = `${type}@${nodeId}`;
    return this.request('GET', `channels/${channelId}`, params, options)
      .then((response) => {
        const data = response.data.channels[0];
        const valuesArray = [];
        Object.keys(data.values).forEach((key) => {
          valuesArray.push([Number.parseInt(key), data.values[key]]);
        });
        data.data = valuesArray;
        return this.normalizeResponse(data, response, options);
      });
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
  // eslint-disable-next-line class-methods-use-this
  normalizeResponse(data, response, normalizeOptions) {
    if (normalizeOptions && normalizeOptions.withResponse) {
      return [data, response];
    }
    return data;
  }

  /**
   * Log a user in.
   *
   * @param  {object} session API response session data.
   */
  registerSession(user) {
    this.client.defaults.headers['X-Omnia-Access-Token'] = user.sessionId;
  }

  /**
   * Log a user out.
   */
  unregisterSession() {
    delete this.client.defaults.headers['X-Omnia-Access-Token'];
  }
}

Object.assign(Hive,
  // Class constants.
  errorCodes,
  {
    VERSION,
  },
  // Static methods.
  {
  });

module.exports = Hive;
