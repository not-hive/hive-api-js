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
      'operator-linebreak': [
        'error',
        'before'
      ],
      'padded-blocks': [
        'error', {
          classes: 'always',
        }
      ],
      'semi': [
        'error',
        'always',
      ],
  },

}
