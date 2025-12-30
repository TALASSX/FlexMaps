const path = require('path');

module.exports = {
    entry: './src/visual.ts',
    devtool: 'source-map',
    mode: 'production',
    optimization: {
        minimize: true
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.less$/,
                use: [
                    {
                        loader: 'style-loader'
                    },
                    {
                        loader: 'css-loader'
                    },
                    {
                        loader: 'less-loader',
                        options: {
                            lessOptions: {
                                paths: [path.resolve(__dirname, 'node_modules')]
                            }
                        }
                    }
                ]
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        path: path.resolve(__dirname, '.tmp/drop'),
        filename: 'visual.js',
        libraryTarget: 'var',
        library: 'powerbi.extensibility.visual'
    },
    externals: {
        'powerbi-visuals-api': '{}'
    }
};
