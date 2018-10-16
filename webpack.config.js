const path = require('path');

const libraryName = 'HiveHome';
const fileName = 'hive-home';

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    filename: `${fileName}.min.js`,
    path: path.resolve(__dirname, 'dist'),
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true,
  },
  devtool: 'source-map',
};
