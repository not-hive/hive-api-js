class Axios {
  request(settings) {
    console.log(settings);
  }
}

Axios.IS_MOCK = true;

module.exports = Axios;
