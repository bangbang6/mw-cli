"use strict";
const Command = require("@mac-mw-cli-dev/command");
const log = require("@mac-mw-cli-dev/log");
const path = require("path");
const fs = require("fs");
const fse = require("fs-extra");
const Git = require("@mac-mw-cli-dev/git");
class PublishCommand extends Command {
  init() {
    this.options = {
      refreshServer: this._cmd.refreshServer,
      refreshToken: this._cmd.refreshToken,
      refreshOwner: this._cmd.refreshOwner,
      buildCmd: this._cmd.buildCmd,
      prod: this._cmd.prod,
      sshUser: this._cmd.sshUser,
      sshIp: this._cmd.sshIp,
      sshPath: this._cmd.sshPath,
    };
  }
  async exec() {
    try {
      const startTime = new Date().getTime();
      // 1.初始化检查
      this.prepare();
      // 2,FLow
      const git = new Git(this.projectInfo, this.options);
      await git.init(); //代码出书画
      await git.commit(); //代码自动化提交
      // 3. 云构建
      await git.publish();
      const endTime = new Date().getTime();
      log.info("本次发布耗时", Math.floor((startTime - endTime) / 1000) + "秒");
    } catch (e) {
      log.error(e.message);
    }
  }
  prepare() {
    // 1.确认项目是否为npm包
    const projectPath = process.cwd();
    const pkgPath = path.resolve(projectPath, "package.json");
    if (!fs.existsSync(pkgPath)) {
      throw new Error("package.json不存在");
    }

    // 2.确认是否包含name version build命令
    const pkg = fse.readJSONSync(pkgPath);
    const { name, version, scripts } = pkg;
    if (!name || !version || !scripts || !scripts.build) {
      throw new Error("package.json信息不全");
    }
    this.projectInfo = { name, version, dir: projectPath };
  }
}

function init(argv) {
  return new PublishCommand(argv);
}
module.exports = init;
module.exports.PublishCommand = PublishCommand;
