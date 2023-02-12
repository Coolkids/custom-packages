import path from "node:path";
import { Configuration } from "webpack";
import { merge } from "webpack-merge";
import { commonWebpackConfig } from "./webpack.common";

const config: Configuration = {
  mode: "production",
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "dist"),
    // path: path.resolve(__dirname, "htdocs/luci-static"),
  },
};

export default merge(commonWebpackConfig, config);
