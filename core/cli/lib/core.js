"use strict";

module.exports = core;

const path = require("path");
const pkg = require("../package.json");
const log = require("@mw-cli-dev/log");
const constant = require("./const");
const semver = require("semver");
const colors = require("colors/safe");
const rootCheck = require("root-check");
const userHome = require("user-home");
const pathExits = require("path-exists").sync;
const minimist = require("minimist");
const dotenv = require("dotenv");
const { getNpmSemverVersion } = require("@mw-cli-dev/get-npm-info");

let args, config;

function core() {
  try {
    checkInputArgs();
    checkPkgVersion();
    checkNodeVersion();
    checkRoot();
    checkUserHome();
    checkEnv();
    checkGlobalUpdate();
  } catch (e) {
    log.error(e);
  }
}
/** 检查版本号 */
const checkPkgVersion = () => {
  log.notice("cli", pkg.version);
};
/** 检查node版本号 */
const checkNodeVersion = () => {
  const currentVersion = process.version;
  const lowNodeVersion = constant.LOWEAST_NODE_VERSION;
  if (!semver.gte(currentVersion, lowNodeVersion)) {
    throw new Error(
      colors.red(`mw-cli需要安装v${lowNodeVersion}以上版本的Node.js`)
    );
  }
};
/** 检查root启动 */
const checkRoot = () => {
  /** root的登录者需要降级 因为这个脚手架需要创建很多文件 不然它创建的文件后面换个登录者都访问不了 */
  rootCheck();
  //   console.log(process.geteuid()); // 都变成了501普通账户了 0是root账户
};
/** 检查用户主目录 */
const checkUserHome = () => {
  // Users/mengwan 这个目录 没有这个目录 后面很多缓存进行不了
  if (!userHome || !pathExits(userHome)) {
    throw new Error(colors.red("当前登陆用户主目录不存在"));
  }
};
/** 检查如参 是否有--debug */
const checkInputArgs = () => {
  args = minimist(process.argv.slice(2));
  checkArgs();
};
const checkArgs = () => {
  if (args && args.debug) {
    process.env.LOGLEVEL = "verbose";
  } else {
    process.env.LOGLEVEL = "info";
  }
  log.level = process.env.LOGLEVEL;
};
/** 检查环境变量 默认在当前目录下面新建一个.env 然后可以通过dotenv读取 */
const checkEnv = () => {
  const dotenvPath = path.resolve(userHome, ".env");
  if (pathExits(dotenvPath)) {
    config = dotenv.config({
      path: path.resolve(userHome, ".env"), //改成从用户主目录下面的.env读取
    });
  } else {
    config = createDefaultConfig();
  }

  log.verbose("环境变量", process.env.CLI_HOME_PATH);
};
const createDefaultConfig = () => {
  const cliConfig = {
    home: userHome,
  };
  if (process.env.CLI_HOME) {
    cliConfig["cliHome"] = path.join(userHome, process.env.CLI_HOME_PATH);
  } else {
    cliConfig["cliHome"] = path.join(userHome, constant.DEFAULT_CLI_HOME);
  }
  process.env.CLI_HOME_PATH = cliConfig.cliHome;
  return config;
};
/** 检查是否需要全局更新 */
const checkGlobalUpdate = async () => {
  const currentVersion = pkg.version;
  const name = pkg.name;
  const lastVersion = await getNpmSemverVersion(currentVersion, name);
  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn(
      colors.yellow(`请手动更新 ${npmName}，当前版本：${currentVersion}，最新版本：${lastVersion}
                  更新命令： npm install -g ${npmName}`)
    );
  }
};
