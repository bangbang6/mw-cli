"use strict";
const Command = require("@mac-mw-cli-dev/command");
const log = require("@mac-mw-cli-dev/log");
const fs = require("fs");
const inquirer = require("inquirer");
const fse = require("fs-extra");
const semver = require("semver");
const getProjectTemplate = require("./getProjectTemplate");
const Package = require("@mac-mw-cli-dev/package");
const userHome = require("user-home");
const path = require("path");
const { spinnerStart, sleep } = require("@mac-mw-cli-dev/utils");

const TYPE_PROJECT = "TYPE_PROJECT";
const TYPE_COMPONENT = "TYPE_COMPONENT";
class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || "";
    this.force = !!this._cmd.force;
    log.verbose("this.projectName", this.projectName);
    log.verbose("this.force", this.force);
  }
  async exec() {
    /** 1. 准备阶段 */
    try {
      const projectInfo = await this.prepare();
      if (projectInfo) {
        /** 下载模版 */
        this.projectInfo = projectInfo;
        await this.downloadTemplate();
      }
    } catch (e) {
      log.error(e.message);
    }
    /** 安装模版 */
  }
  /** 判断目录空的准备阶段 以及强制更新*/
  async prepare() {
    // 判断项目模版是否存在
    const template = await getProjectTemplate();
    if (!template || template.length === 0) {
      throw new Error("项目模版不存在");
    }
    this.template = template;
    const localPath = process.cwd();

    const ret = this.ifDirIsEmpty(localPath);
    if (!ret) {
      let ifContinue = false;
      if (!this.force) {
        //询问是否继续创建

        const result = await inquirer.prompt({
          type: "confirm",
          message: "当前文件夹不为空,是否继续创建项目?",
          name: "ifContinue",
          default: false,
        });
        ifContinue = result.ifContinue;
        if (!ifContinue) {
          return;
        }
        if (ifContinue) {
          const { confirmDelete } = await inquirer.prompt({
            type: "confirm",
            message: "是否确认清空当前目录下的文件?",
            name: "confirmDelete",
            default: false,
          });
          if (confirmDelete) {
            /** 清空当前目录 */
            fse.emptyDirSync(localPath);
          }
        }
      } else {
        const { confirmDelete } = await inquirer.prompt({
          type: "confirm",
          message: "是否确认清空当前目录下的文件?",
          name: "confirmDelete",
          default: false,
        });
        if (confirmDelete) {
          /** 清空当前目录 */
          fse.emptyDirSync(localPath);
        }
      }
    }
    return this.getProjectInfo();
  }
  /** 获取项目的基本信息 */
  async getProjectInfo() {
    function isValidName(v) {
      return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(
        v
      );
    }
    let projectInfo = {};
    /** 选择创建项目还是组件 */
    const answers = await inquirer.prompt({
      type: "list",
      message: "请选择初始化类型",
      default: TYPE_PROJECT,
      name: "type",
      choices: [
        {
          name: "项目",
          value: TYPE_PROJECT,
        },
        {
          name: "组件",
          value: TYPE_PROJECT,
        },
      ],
    });
    const type = answers.type;
    if (type === TYPE_PROJECT) {
      const answers = await inquirer.prompt([
        {
          type: "input",
          message: "请输入项目名称:",
          name: "projectName",
          default: "",
          validate: function (v) {
            const done = this.async();

            // Do async stuff
            setTimeout(function () {
              if (!isValidName(v)) {
                // Pass the return value in the done callback
                done("请输入合法的项目名称");
              } else {
                done(null, true);
              }
            }, 0);
          },
          filter: (v) => {
            return v;
          },
        },
        {
          type: "input",
          message: "请输入项目版本号:",
          name: "projectVersion",
          default: "1.0.0",
          validate: function (v) {
            const done = this.async();

            // Do async stuff
            setTimeout(function () {
              if (!!!semver.valid(v)) {
                // Pass the return value in the done callback
                done("请输入合法的项目版本号");
              } else {
                done(null, true);
              }
            }, 0);
          },
          filter: (v) => {
            if (semver.valid(v)) {
              return semver.valid(v);
            } else {
              return v;
            }
          },
        },
        {
          type: "list",
          message: "请选择项目模版:",
          name: "projectTemplate",
          choices: this.createTemplateChoices(),
        },
      ]);
      projectInfo = { type, ...answers };
    } else if (type === TYPE_COMPONENT) {
    }
    return projectInfo;
  }
  /** 下载项目模版 */
  async downloadTemplate() {
    const { projectTemplate } = this.projectInfo;
    const templateInfo = this.template.find(
      (item) => item.npmName === projectTemplate
    );
    const targetPath = path.resolve(
      userHome,
      process.env.CLI_HOME_PATH,
      "template"
    );
    const storeDir = path.resolve(targetPath, "node_modules");
    const { npmName, version } = templateInfo;
    const templateNpm = new Package({
      targetPath,
      storeDir,
      name: npmName,
      version: version,
    });
    const isExits = await templateNpm.exits();
    if (!isExits) {
      const spinner = spinnerStart("下载模版中");
      await sleep();
      try {
        await templateNpm.install();
        log.success("下载模版成功");
      } catch (e) {
        throw new Error("下载模版失败");
      } finally {
        spinner.stop(true);
      }
    } else {
      const spinner = spinnerStart("更新模版中");
      await sleep();
      try {
        await templateNpm.update();
        log.success("更新模版成功");
      } catch (e) {
        throw new Error("更新模版失败");
      } finally {
        spinner.stop(true);
      }
    }
  }

  ifDirIsEmpty(localPath) {
    /** 判断项目是否为空 */
    let fileList = fs.readdirSync(localPath);
    fileList = fileList.filter((file) => {
      return !file.startsWith(".") && ["node_modules"].indexOf(file) < 0;
    });
    return !fileList || fileList.length <= 0;
  }

  createTemplateChoices() {
    return this.template.map((template) => {
      return {
        value: template.npmName,
        name: template.name,
      };
    });
  }
}
const index = (argv) => {
  return new InitCommand(argv);
};

module.exports.InitCommand = InitCommand;
module.exports = index;
