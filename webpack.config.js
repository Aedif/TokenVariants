const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env) => {
  return {
    entry: './token-variants/token-variants.mjs',
    output: {
      filename: 'token-variants.js',
      path: path.resolve(__dirname, 'token-variants/bundle'),
      publicPath: 'modules/bundle/token-variants/',
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
    watch: env?.mode === 'watch' ? true : false,
    watchOptions: {
      ignored: ['**/node_modules/', '**/scripts/libs/'],
    },
    devtool: 'source-map',
  };
};
