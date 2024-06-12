"use strict";
/**
 * 动态加载命令包
 */

const Package = require("@mac-mw-cli-dev/package");
const log = require("@mac-mw-cli-dev/log");
const path = require("path");
const CACHE_DIR = "dependencies";

const SETTINGS = {
  init: "@mac-mw-cli-dev/init", // important 这里可以根据不同的公司用不同的init包 然后不指定targetPath 那么脚手架会把这个包缓存到本地 然后用这个包去执行方法 而且会判断是否有新版本更新
};

const exec = async (...args) => {
  let targetPath = process.env.CLI_TARGET_PATH;
  let storeDir = "";
  let pkg;
  const homePath = process.env.CLI_HOME_PATH;
  log.verbose("targetPath", targetPath);
  log.verbose("homePath", homePath);
  const cmdObj = args[args.length - 1];
  const cmdName = cmdObj.name();
  const npmPackageName = SETTINGS[cmdName]; //不同公司的init包名字
  const packageVersion = "latest";
  if (!targetPath) {
    /** 换成缓存目录路径 */
    targetPath = path.resolve(homePath, CACHE_DIR);
    storeDir = path.resolve(targetPath, "node_modules");
    log.verbose("targetPath", targetPath);
    log.verbose("storeDir", storeDir);
    pkg = new Package({
      targetPath,
      name: npmPackageName,
      version: packageVersion,
      storeDir,
    });
    if (await pkg.exits()) {
      await pkg.update();
    } else {
      await pkg.install();
    }
  } else {
    // 有targetPath直接 不走缓存 直接走指定的init包路径 这个时候storeDir不存在 后续Package根据storeDir判断是否是指定targetPath包的模式
    pkg = new Package({
      targetPath,
      name: npmPackageName,
      version: packageVersion,
    });
  }
  const rootFile = pkg.getRootFilePath();
  if (rootFile) {
    // 当前进程中调用 无法充分利用cpu资源
    require(rootFile).apply(null, args);
    // 在node 多进程调用
  }
};
module.exports = exec;
