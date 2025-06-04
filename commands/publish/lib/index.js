"use strict";
const Command = require("@mac-mw-cli-dev/command");
const log = require("@mac-mw-cli-dev/log");
const path = require("path");
const fs = require("fs");
const fse = require("fs-extra");
class PublishCommand extends Command {
  init() {
    console.log("this._argv,", this._argv);
  }
  exec() {
    try {
      const startTime = new Date().getTime();
      // 1.初始化检查
      this.prepare();
      // 2,FLow
      // 3. 云构建
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
