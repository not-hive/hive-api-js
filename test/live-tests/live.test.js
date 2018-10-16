
const Hive = require('../../src/index');
const Session = require('../../src/session');

const local = require('../../local.js');

describe('Hive', () => {
  it('should reject a request that is not logged in', () => {
    const hive = new Hive();
    return hive.getNodes()
      .then(() => {
        expect(false).toBe(true);
      })
      .catch((error) => {
        expect(error.code).toBe('NOT_AUTHENTICATED');
      });
  });
});

describe('Session', () => {
  describe('login', () => {
    it('should reject an invalid login', () => {
      const hive = new Hive();
      const session = new Session(hive);
      expect.assertions(1);
      return session.login('anyone@example.com', 'password')
        .catch((error) => {
          expect(error.code).toBe('BAD_REQUEST');
        });
    });

    it('should reject an incorrect password', () => {
      const hive = new Hive();
      const session = new Session(hive);
      expect.assertions(1);
      return session.login(local.user, 'password')
        .catch((error) => {
          expect(error.code).toBe('BAD_REQUEST');
        });
    });

    it('should accept a valid login', () => {
      const hive = new Hive();
      const session = new Session(hive);
      return session.login(local.user, local.pass)
        .then((user) => {
          expect(user.username).toBe(local.user);
          expect(user.sessionId).toBeTruthy();
        });
    });
  });

  describe('logout', () => {
    it('should log out when not logged in', () => {
      const hive = new Hive();
      const session = new Session(hive);
      expect.assertions(1);
      return session.logout()
        .then((response) => {
          expect(response.status).toBe(401);
        });
    });

    it('should log out when logged in', () => {
      const hive = new Hive();
      const session = new Session(hive);
      expect.assertions(3);
      return session.login(local.user, local.pass)
        .then((user) => {
          expect(user.username).toBe(local.user);
          expect(user.sessionId).toBeTruthy();
          return session.logout(user)
            .then((response) => {
              expect(response.status).toBe(200);
            });
        });
    });
  });
});
