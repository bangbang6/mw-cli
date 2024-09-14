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
const { spinnerStart, sleep, execSync } = require("@mac-mw-cli-dev/utils");
const kebabaCase = require("kebab-case");
const glob = require("glob");
const ejs = require("ejs");

const TYPE_PROJECT = "project";
const TYPE_COMPONENT = "component";

const TEMPLATE_TYPE_NORMAL = "normal";
const TEMPLATE_TYPE_CUSTOM = "custom";

const WHITE_COMMAND = ["npm", "cnpm"];
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
        // 安装模版
        await this.installTemplate();
      }
    } catch (e) {
      log.error(e.message);
    }
  }
  /** 安装模版 */
  async installTemplate() {
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
      }
      if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
        this.installNormalTemplate();
      } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
        this.installCustomTemplate();
      } else {
        throw new Error("项目模版信息无法识别");
      }
    } else {
      throw new Error("项目模版信息不存在");
    }
  }
  async installNormalTemplate() {
    let spinner = spinnerStart("正在安装模版");
    await sleep();
    try {
      const cacheFilePath = this.templateNpm.cacheFilePath;
      const templatePath = path.resolve(cacheFilePath, "template");
      const targetPath = process.cwd();
      fse.ensureDirSync(templatePath);
      fse.ensureDirSync(targetPath);
      fse.copySync(templatePath, targetPath);
    } catch (e) {
      log.error(e.message);
    } finally {
      spinner.stop(true);
      log.success("模版安装成功");
    }
    const templateIgnore = this.templateInfo.ignore || [];
    const ignore = ["node_modules/**", "src/assets/**", ...templateIgnore];
    const options = {
      ignore,
      nodir: true,
      cwd: process.cwd(),
    };
    await this.ejsRender(options);
    //依赖安装
    if (this.templateInfo.installCommand) {
      const { installCommand, startCommand } = this.templateInfo;
      if (installCommand) {
        await this.execCommand(installCommand, "依赖安装失败");
      }
      if (startCommand) {
        await this.execCommand(startCommand, "项目启动失败");
      }
    }
  }

  async installCustomTemplate() {
    if (await this.templateNpm.exits()) {
      const rootFile = this.templateNpm.getRootFilePath();
      if (fs.existsSync(rootFile)) {
        log.notice("开始执行自定义模板");
        const templatePath = path.resolve(
          this.templateNpm.cacheFilePath,
          "template"
        );
        const options = {
          templateInfo: this.templateInfo,
          projectInfo: this.projectInfo,
          sourcePath: templatePath,
          targetPath: process.cwd(),
        };
        const code = `require('${rootFile}')(${JSON.stringify(options)})`;
        await execSync("node", ["-e", code], {
          stdio: "inherit",
          cwd: process.cwd(),
        });
        log.success("自定义模板安装成功");
      } else {
        throw new Error("自定义模板入口文件不存在！");
      }
    }
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
          value: TYPE_COMPONENT,
        },
      ],
    });
    const type = answers.type;
    const title = type === TYPE_PROJECT ? "项目" : "组件";

    this.template = this.template.filter((temp) => {
      return temp.tag.includes(type);
    });
    const namePrompt = {
      type: "input",
      message: `请输入${title}名称:`,
      name: "projectName",
      default: "",
      validate: function (v) {
        const done = this.async();

        // Do async stuff
        setTimeout(function () {
          if (!isValidName(v)) {
            // Pass the return value in the done callback
            done(`请输入合法的${title}名称`);
          } else {
            done(null, true);
          }
        }, 0);
      },
      filter: (v) => {
        return v;
      },
    };
    let isProjectNameValidate = false;
    if (isValidName(this.projectName)) {
      isProjectNameValidate = true;
    }
    let inquirerList = [
      {
        type: "input",
        message: `请输入${title}版本号:`,
        name: "projectVersion",
        default: "1.0.0",
        validate: function (v) {
          const done = this.async();

          // Do async stuff
          setTimeout(function () {
            if (!!!semver.valid(v)) {
              // Pass the return value in the done callback
              done(`请输入合法的${title}版本号`);
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
        message: `请选择${title}模版:`,
        name: "projectTemplate",
        choices: this.createTemplateChoices(),
      },
    ];
    if (!isProjectNameValidate) {
      inquirerList.unshift(namePrompt);
    }

    if (type === TYPE_PROJECT) {
      const answers = await inquirer.prompt(inquirerList);

      projectInfo = { type, projectName: this.projectName, ...answers };
    } else if (type === TYPE_COMPONENT) {
      const descriptionPrompt = {
        type: "input",
        message: "请输入组件描述:",
        name: "componentDesc",
        default: "",
        validate: function (v) {
          const done = this.async();

          // Do async stuff
          setTimeout(function () {
            if (!v) {
              // Pass the return value in the done callback
              done("请输入组件描述信息!");
            } else {
              done(null, true);
            }
          }, 0);
        },
        filter: (v) => {
          return v;
        },
      };
      inquirerList.push(descriptionPrompt);
      const answers = await inquirer.prompt(inquirerList);

      projectInfo = { type, projectName: this.projectName, ...answers };
    }
    if (projectInfo.projectName) {
      projectInfo.className = kebabaCase(projectInfo.projectName).replace(
        /^-/,
        ""
      );
    }
    if (projectInfo.projectName) {
      projectInfo.name = projectInfo.projectName;
      projectInfo.version = projectInfo.projectVersion;
    }
    if (projectInfo.componentDesc) {
      projectInfo.description = projectInfo.componentDesc;
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
    this.templateInfo = templateInfo;
    const templateNpm = new Package({
      targetPath,
      storeDir,
      name: npmName,
      version: version,
    });
    this.templateNpm = templateNpm;
    const isExits = await templateNpm.exits();
    if (!isExits) {
      const spinner = spinnerStart("下载模版中");
      await sleep();
      try {
        await templateNpm.install();
      } catch (e) {
        throw new Error("下载模版失败");
      } finally {
        spinner.stop(true);
        if (await templateNpm.exits()) {
          log.success("下载模版成功");
        }
      }
    } else {
      const spinner = spinnerStart("更新模版中");
      await sleep();
      try {
        await templateNpm.update();
      } catch (e) {
        throw new Error("更新模版失败");
      } finally {
        spinner.stop(true);
        if (await templateNpm.exits()) {
          log.success("更新模版成功");
        }
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

  checkCommand(cmd) {
    if (WHITE_COMMAND.includes(cmd)) {
      return true;
    }
    return false;
  }
  async execCommand(command, msg) {
    const Cmd = command.split(" ");
    const cmd = Cmd[0];
    if (this.checkCommand(cmd)) {
      const args = Cmd.slice(1);
      const res = await execSync(cmd, args, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      if (res !== 0) {
        throw new Error(msg);
      }
    } else {
      throw new Error("命令不在白名单内");
    }
  }
  async ejsRender(options) {
    return new Promise((resolve, reject) => {
      const dir = process.cwd();
      glob("**", { ...options, cwd: dir }, (err, files) => {
        if (err) {
          reject(err);
        }
        Promise.all(
          files.map((file) => {
            const filePath = path.join(dir, file);
            return new Promise((resolve1, reject1) => {
              ejs.renderFile(filePath, this.projectInfo, {}, (err, result) => {
                if (err) {
                  console.log("filePath", filePath);

                  reject1(err);
                }
                fse.writeFileSync(filePath, result);
                resolve1(result);
              });
            });
          })
        ).then((res) => {
          resolve(res);
        });
      });
    });
  }
}
const index = (argv) => {
  return new InitCommand(argv);
};

module.exports.InitCommand = InitCommand;
module.exports = index;
