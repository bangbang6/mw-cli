"use strict";
const SimpleGit = require("simple-git");
const userHome = require("user-home");
const utils = require("@mac-mw-cli-dev/utils");
const path = require("path");
const fse = require("fs-extra");
const fs = require("fs");
const inquirer = require("inquirer");
const terminalLink = require("terminal-link");
const { DEFAULT_CLI_HOME } = require("../../../core/cli/lib/const");
const Github = require("./Github");
const Gitee = require("./Gitee");
const GIT_SERVER_FILE = ".git_server";
const GIT_Token_FILE = ".git_token";
const GIT_ROOT_DIR = ".git";
const GITHUB = "github";
const GITEE = "gitee";
const GITSERVERTYPE = [
  {
    name: "Github",
    value: GITHUB,
  },
  { name: "Gitee", value: GITEE },
];
class Git {
  constructor(
    { name, version, dir },
    { refreshServer = false, refreshToken = false }
  ) {
    this.name = name;
    this.version = version;
    this.dir = dir;
    this.git = SimpleGit(dir);
    this.gitServer = null;
    this.homePath = null;
    this.refreshServer = refreshServer;
    this.refreshToken = refreshToken;
  }
  checkHomePath() {
    if (!this.homePath) {
      if (process.env.CLI_HOME_PATH) {
        this.homePath = process.env.CLI_HOME_PATH;
      } else {
        this.homePath = path.resolve(userHome, DEFAULT_CLI_HOME);
      }
    }
    fse.ensureDirSync(this.homePath);
    if (!fs.existsSync(this.homePath)) {
      throw new Error("用户主目录获取失败");
    }
  }
  async checkGitServer() {
    const gitServerPath = this.createPath(GIT_SERVER_FILE);
    let gitServer = utils.readFile(gitServerPath);
    if (!gitServer || this.refreshServer) {
      gitServer = (
        await inquirer.prompt({
          type: "list",
          message: "请选择您想要托管的git平台",
          default: GITHUB,
          name: "gitServer",
          choices: GITSERVERTYPE,
        })
      ).gitServer;
      utils.writeFile(gitServerPath, gitServer);
    }
    this.gitServer = this.createGitServer(gitServer);
    if (!this.gitServer) {
      throw new Error("git server初始化失败");
    }
  }
  createPath(file) {
    const rootDir = path.resolve(this.homePath, GIT_ROOT_DIR);
    const filePath = path.resolve(rootDir, file);
    fse.ensureDirSync(rootDir);
    return filePath;
  }

  createGitServer(gitServer = "") {
    if (gitServer == GITHUB) {
      return new Github();
    } else if (gitServer === GITEE) {
      return new Gitee();
    }
  }

  async checkGitToken() {
    const tokenPath = this.createPath(GIT_Token_FILE);
    let token = utils.readFile(tokenPath);
    if (!token || this.refreshToken) {
      console.warn(
        this.gitServer.type +
          "token未生成,请先生成" +
          this.gitServer.type +
          " " +
          terminalLink("点此链接跳转", this.gitServer?.getTokenHelpUrl())
      );
      token = (
        await inquirer.prompt({
          type: "password",
          message: "请将token复制到这里",
          default: "",
          name: "token",
        })
      ).token;
      utils.writeFile(tokenPath, token);
      console.log(`git token 写入成功 ${token} -> ${tokenPath}`);
    }
    this.token = token;
    this.gitServer.setToken(token);
  }
  async prepare() {
    // 检查缓存住目录
    this.checkHomePath();
    // 检查用户远程仓库类型
    await this.checkGitServer();
    await this.checkGitToken(); //获取远程仓库token
  }
  init() {
    this.prepare();
  }
}
module.exports = Git;
