"use strict";

module.exports = core;

const path = require("path");
const pkg = require("../package.json");
const log = require("@mw-cli-dev/log");
const constant = require("./const");
const colors = require("colors/safe");
const rootCheck = require("root-check");
const userHome = require("user-home");
const pathExits = require("path-exists").sync;
const dotenv = require("dotenv");
const { getNpmSemverVersion } = require("@mw-cli-dev/get-npm-info");
const commander = require("commander");
const init = require("@mw-cli-dev/init");
const program = new commander.Command();
const exec = require("@mw-cli-dev/exec");
const semver = require("semver");

let args, config;

async function core() {
  try {
    await prepare();
    registerCommand();
  } catch (e) {
    log.error(e);
    if (program.debug) {
      console.log(e);
    }
  }
}
const prepare = async () => {
  checkPkgVersion();
  checkRoot();
  checkUserHome();
  checkEnv();
  await checkGlobalUpdate();
};
/** 检查版本号 */
const checkPkgVersion = () => {
  log.notice("cli", pkg.version);
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

/** 检查环境变量 默认在当前目录下面新建一个.env 然后可以通过dotenv读取 */
const checkEnv = () => {
  const dotenvPath = path.resolve(userHome, ".env");
  if (pathExits(dotenvPath)) {
    dotenv.config({
      path: path.resolve(userHome, ".env"), //改成从用户主目录下面的.env读取
    });
  }
  createDefaultConfig();
};
const createDefaultConfig = () => {
  const cliConfig = {
    home: userHome,
  };
  if (process.env.CLI_HOME_PATH) {
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
/** 注册命令 */
const registerCommand = () => {
  program
    .usage("<command> [options]")
    .name(Object.keys(pkg.bin)[0])
    .option("-d --debug", "是否开启调试模式", false)
    .option("-tp --targetPath <targetPath>", "是否指定本地调试路径")
    .version(pkg.version);

  /** 定制debug模式 */
  program.on("option:debug", function () {
    if (program.debug) {
      process.env.LOGLEVEL = "verbose";
    } else {
      process.env.LOGLEVEL = "info";
    }
    log.level = process.env.LOGLEVEL;
  });
  /** 对未知命令监听 */
  program.on("command:*", (obj) => {
    const avaliableCommands = program.commands.map((cmd) => cmd.name());
    console.log(colors.red("未知的命令" + obj[0]));
    if (avaliableCommands.length > 0) {
      console.log(colors.red("可用的命令:" + avaliableCommands.join(",")));
    }
  });
  /** 指定全局的targetPath */
  program.on("option:targetPath", () => {
    process.env.CLI_TARGET_PATH = program.targetPath;
  });
  /** 1.init命令 */
  const command = program.command("init [projectName]");
  command.option("-f --force", "是否强制初始化", false).action(exec);

  /** 2.publish命令 */
  program.command("publish").action(exec);

  program.parse(process.argv);
  /** 不输入命令的时候打印帮助文档 */
  if (program.args && program.args.length < 1) {
    program.outputHelp();
    console.log();
  }
};
