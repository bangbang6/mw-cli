#! /usr/bin/env node

const importLocal = require("import-local");

if (importLocal(__filename)) {
  require("npmlog").info(
    "cli",
    "正在使用mac-mw-cli线上npm安装到了node_modules的版本"
  );
} else {
  require("../lib/core")(process.argv.slice(2));
}
