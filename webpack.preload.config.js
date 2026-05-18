const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './src/preload.ts',
  target: 'electron-preload',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: { configFile: 'tsconfig.main.json' },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  output: {
    filename: 'preload.js',
    path: path.resolve(__dirname, 'build/main'),
  },
  externals: {
    'electron': 'commonjs electron',
  },
  node: {
    __dirname:  false,
    __filename: false,
  },
};
