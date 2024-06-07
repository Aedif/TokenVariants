const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './token-variants/token-variants.mjs',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'token-variants'),
    publicPath: 'modules/token-variants/',
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
          keep_fnames: false,
        },
      }),
    ],
  },
  mode: 'production',
  watch: true,
  devtool: 'source-map',
};
