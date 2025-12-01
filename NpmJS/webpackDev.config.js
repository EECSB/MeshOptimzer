const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
    mode: "development",
    entry: ["./src/threeinterop.js"],
    output: {
        path: path.resolve(__dirname, "../wwwroot/js/webpack-bundle"),
        filename: "index.bundle.js"
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.ttf$/,
                use: ['file-loader']
            }
        ]
    },
    plugins: [],
    optimization: {
        //We don't want to minimize our code(while developing).
        minimize: false,
        minimizer: [
            new TerserPlugin({
                parallel: true,
                terserOptions: {
                    // https://github.com/webpack-contrib/terser-webpack-plugin#terseroptions
                }
            })
        ]
    }
}