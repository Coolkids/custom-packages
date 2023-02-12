import path from "node:path";
import postcssPresetEnv from "postcss-preset-env";
import { Configuration } from "webpack";

export const commonWebpackConfig: Configuration = {
  entry: {
    index: path.resolve(__dirname, "src/index.ts"),
  },
  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: [".ts", ".tsx", ".js"],
    // Add support for TypeScripts fully qualified ESM imports.
    extensionAlias: {
     ".js": [".js", ".ts"],
     ".cjs": [".cjs", ".cts"],
     ".mjs": [".mjs", ".mts"]
    }
  },
  module: {
    rules: [
      {
        test: /\.s[ac]ss$/i,
        use: [
          { loader: "style-loader" },
          { loader: "css-loader" },
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [postcssPresetEnv({})],
              },
            },
          },
          { loader: "sass-loader" },
        ],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      { test: /\.([cm]?ts|tsx)$/, loader: "ts-loader" }
    ],
  },
  plugins: [
    //postcssPresetEnv() as unknown as WebpackPluginInstance
  ],
};
