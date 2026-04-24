//@ts-check

'use strict';

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/** @typedef {import('webpack').Configuration} WebpackConfig */

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node', // VS Code extensions run in a Node.js-context
  mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

  entry: './src/extension.ts', // the entry point of this extension
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  devtool: 'nosources-source-map',
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on the fly and must be excluded
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};

/** @type WebpackConfig */
const webviewConfig = {
  target: 'web', // Webviews run in a browser-like context
  mode: 'none', // same as extension
  entry: './src/webview-ui/src/log-webview.ts', // Entry point for the log webview script
  output: {
    path: path.resolve(__dirname, 'dist', 'webview-ui'), // Output to dist/webview-ui
    filename: 'log-webview.js' // Output filename
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          context: path.resolve(__dirname, 'src', 'webview-ui'),
          from: '**/*',
          to: path.resolve(__dirname, 'dist', 'webview-ui'),
          globOptions: {
            ignore: ['**/src/**', '**/*.ts'],
          },
        },
      ],
    }),
  ],
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log",
  },
  performance: {
    hints: false
  }
};

// Export both configurations
module.exports = [extensionConfig, webviewConfig];
