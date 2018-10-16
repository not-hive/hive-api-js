
class Session {
  constructor(hive) {
    this.hive = hive;
  }


  /**
   * Send a log in request and set the user to logged in if successful.
   *
   * @param  {string} username The user name (email) to log in.
   * @param  {string} password Plain text password.
   * @param  {object} options  Request options.
   * @return {Promise} Hive request promise.
   */
  login(username, password, options) {
    const data = {
      sessions: [{
        username,
        password,
      }],
    };

    this.hive.unregisterSession();

    return this.hive.request('POST', 'auth/sessions', data)
      .then((response) => {
        const user = response.data.sessions[0];
        this.hive.registerSession(user);
        return this.hive.normalizeResponse(user, response, options);
      })
      .catch((error) => {
        // @REVISIT move the login specific error handling here?
        throw error;
      });
  }

  /**
   * Send a log out request and set the user to logged out.
   */
  logout(user, options) {
    const path = `auth/sessions/${(user) ? user.sessionId : ''}`;
    return this.hive.request('DELETE', path, null, {
      validateStatus(status) {
        // treat Unauthorized etc. as successful
        return status === 200 || status === 400 || status === 401 || status === 403;
      },
    }).then((response) => {
      this.hive.unregisterSession();
      return this.hive.normalizeResponse({
        status: response.status,
        statusText: response.statusText,
      }, response, options);
    }).catch((error) => {
      this.hive.unregisterSession();
      throw error;
    });
  }
}

module.exports = Session;
