module.exports = {
  entry: './index.ts', 
  mode: 'development',
  devtool: 'source-map',
  output: {
    path: __dirname + '/models',
    filename: 'index.js'
  },
  resolveLoader: {
    modules: [
      __dirname + '/node_modules'
    ]
  },
  resolve: {
    modules: [
      __dirname + '/node_modules'
    ],
    extensions: ['.ts', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.(ts)$/,
        loader: 'ts-loader'
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
    ]
  },
  node: {
    global: true
  }
};