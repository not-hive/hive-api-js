module.exports = {

  'env': {
    'browser': true,
    'node': true
  },

  'extends': 'standard',
    'rules': {
      'comma-dangle': [
        'off'
      ],
      'padded-blocks': [
        'error', {
          classes: 'always',
        }
      ],
  },

}
