"use strict";
const semver = require("semver");
const colors = require("colors");
const log = require("@mac-mw-cli-dev/log");
const LOWEAST_NODE_VERSION = "12.0.0";

class Command {
  constructor(argv) {
    if (!argv) {
      throw new Error("参数不能为空");
    }
    if (!Array.isArray(argv)) {
      throw new Error("参数必须为数组");
    }
    if (argv.length < 1) {
      throw new Error("参数列表为空");
    }

    this._argv = argv;

    /** 任务依次异步执行 */
    let runner = new Promise((resolve, reject) => {
      let chain = Promise.resolve();
      chain = chain.then(() => this.checkNodeVersion());
      chain = chain.then(() => this.initArgs());
      chain = chain.then(() => this.init());
      chain = chain.then(() => this.exec());
      /** 异步执行的任务不会在core方法那里统一普获 等单独普获 每块异步任务都得单独补货 */
      chain.catch((err) => {
        log.error(err.message);
      });
    });
  }

  /** 检查node版本号 */
  checkNodeVersion = () => {
    const currentVersion = process.version;
    const lowNodeVersion = LOWEAST_NODE_VERSION;
    if (!semver.gte(currentVersion, lowNodeVersion)) {
      throw new Error(
        colors.red(`mw-cli需要安装v${lowNodeVersion}以上版本的Node.js`)
      );
    }
  };
  /** 初始化参数 */
  initArgs() {
    this._cmd = this._argv[this._argv.length - 1];
    this._argv = this._argv.slice(0, this._argv.length - 1);
  }
  /** 准备阶段 */
  init() {
    throw new Error("init 必须实现");
  }
  exec() {
    throw new Error("exec 必须实现");
  }
}
module.exports = Command;
