const HtmlWebpackPlugin = require("html-webpack-plugin")
const fs = require("fs")
const path = require("path")
const os = require("os")
const appDirectory = fs.realpathSync(process.cwd())
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath)

function getIPAdress() {
  var interfaces = os.networkInterfaces()
  for (var devName in interfaces) {
    var iface = interfaces[devName]
    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i]
      if (alias.family === "IPv4" && alias.address !== "127.0.0.1" && !alias.internal) {
        return alias.address
      }
    }
  }
}

module.exports = {
  mode: "development",
  entry: "./src/index.js",
  output: {
    filename: "main.js",
    filename: "bundle.js",
    path: path.resolve(appDirectory, "dist"),
  },
  devServer: {
    contentBase: path.resolve(appDirectory, "dist"),
    host: getIPAdress() || "0.0.0.0",
  },
  module: {
    rules: [
      {
        test: /\.(mjs|js|jsx|ts)$/,
        use: [
          {
            loader: "babel-loader",
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: resolveApp("public/index.html"),
    }),
  ],
}
