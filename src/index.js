/*!
 * Hive heating system API.
 * 
 * The api is documented at http://api-prod.bgchprod.info/omnia/
 * 
 * @copyright Copyright (c) 2018 Paul Bloomfield.
 * @license MIT.
 */

"use strict";

// dependencies
var axios = require("axios");

/**
 * The Hive class.
 * 
 * @class
 */
var Hive = function () {

  var that = this;

  this.messages = {
    INVALID_LOGIN: "INVALID_LOGIN",
    ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  };

  this.nodes = null;
  this.user = null;

  /**
   * @var {axios} Hive~client Axios instance.
   */
  var client = axios.create({
    baseURL: "https://api-prod.bgchprod.info:443/omnia/",
    timeout: 4000,
    headers: {
      "Content-Type": "application/vnd.alertme.zoo-6.5+json",
      "Accept": "application/vnd.alertme.zoo-6.5+json",
      "X-Omnia-Client": "Hive Web Dashboard",
    },
  });

  /**
   * Send a request to the Hive API.
   * 
   * @param {string} method The HTTP method.
   * @param {string} path The path (relative to the base URL set for the client).
   * @param {object} data Key-value pairs to be sent as JSON data (or URL-encoded for GET request).
   * @param {object} options Options to set or override for this request.
   */
  this.request = function (method, path, data, options) {
    return client.request(Hive.extend({
      method: method,
      url: path,
      data: data,
    }, options));
  };

  /**
   * Load nodes for the current user.
   * 
   * @return {object} Axios request promise.
   */
  this.loadNodes = function () {
    var request = this.getNodes();

    request.then(function (response) {
      that.nodes = response.data.nodes;
    });

    return request;
  };

  /**
   * Make a get nodes request.
   * 
   * @return {object} Axios request promise.
   */
  this.getNodes = function () {  
    return this.request("GET", "nodes");
  };

  /**
   * Private method to log a user in.
   * 
   * @param  {object} session API response session data.
   */
  var login = function (session) {
    that.user = {
      id: session.userId,
      username: session.username,
      session: session,
    };
    client.defaults.headers["X-Omnia-Access-Token"] = session.sessionId;
  };

  /**
   * Private method to log a user out.
   */
  var logout = function () {
    that.user = null;
    delete client.defaults.headers["X-Omnia-Access-Token"];
  };

  /**
   * Send a log in request and set the user to logged in if successful.
   * 
   * @param  {string} username The user name (email) to log in.
   * @param  {string} password Plain text password.
   * @return {object} Axios request promise.
   */
  this.login = function (username, password) {

    var data = {sessions: [{
      username: username,
      password: password,
    }]};
    logout();

    var request = this.request("POST", "auth/sessions", data);

    request.then(function (response) {
      login(response.data.sessions[0]);
    });

    request.catch(function (error) {
      that.user = null;
      try {
        var code = error.response.data.errors[0].code;
        if (code === "USERNAME_PASSWORD_ERROR") {
          // deal with invalid username/password
          that.user = {
            error: that.messages.INVALID_LOGIN,
          };
        } else if (code === "ACCOUNT_LOCKED") {
          // deal with account locked
          that.user = {
            error: that.messages.ACCOUNT_LOCKED,
          };
        }
      } catch (e) {
        // empty block
      }
      return error;
      // return error.response;
    });

    return request;
  };

  /**
   * Send a log out request and set the user to logged out.
   */
  this.logout = function () {
    var path = "auth/sessions/" + ((this.user && this.user.session) ? this.user.session.sessionId : "");
    return this.request("DELETE", path, null, {
      validateStatus: function (status) {
        // treat Unauthorized etc. as successful
        return status == 200 || status == 400 || status == 401 || status == 403;
      }        
    }).then(function () {
      logout();
    });
  };

};

/** @var {string} Hive.VERSION Version number. */
Hive.VERSION = "0.1.0";

/** @function Hive.extend() Simple object extension. */
Hive.extend = function () {
  var options;
  var name;
  var target = arguments[0] || {};

  for (var i = 1; i < arguments.length; i++) {
    // Only deal with non-null/undefined values
    if ((options = arguments[i]) != null) {
      // Extend the base object
      for (name in options) {
        target[name] = options[name];
      }
    }
  }
  return target;
};

module.exports = Hive;
