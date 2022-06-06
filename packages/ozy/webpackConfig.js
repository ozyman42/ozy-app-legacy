const nrwlConfig = require("@nrwl/react/plugins/webpack.js");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

module.exports = config => {
    nrwlConfig(config);
    return {
        ...config,
        node: {
            ...config.node,
            global: true
        },
        plugins: [
            new NodePolyfillPlugin(),
            ...config.plugins
        ]
    }
}