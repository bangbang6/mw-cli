"use strict";
const path = require("path");
module.exports = formatPath;

/** mac和window路径兼容 */
function formatPath(path) {
  if (path && typeof path === "string") {
    const sep = path.sep; //分隔符 mac是/ windows是\
    if (sep === "/") {
      return path;
    } else {
      return path.replace(/\\/g, "/");
    }
  }
  return path;
}
