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
const { log } = require("console");
const GIT_SERVER_FILE = ".git_server";
const GIT_Token_FILE = ".git_token";
const GIT_ROOT_DIR = ".git";
const GITHUB = "github";
const GITEE = "gitee";
const GIT_OWN_FILE = ".git_own";
const GIT_LOGIN_FILE = ".git_login";
const REPO_OWNER_USER = "user";
const REPO_OWNER_ORG = "org";
const GIT_IGOREE_FILE = ".gitignore";
const GITSERVERTYPE = [
  {
    name: "Github",
    value: GITHUB,
  },
  { name: "Gitee", value: GITEE },
];
const GIT_OWNER_TYPE = [
  {
    name: "个人",
    value: REPO_OWNER_USER,
  },
  { name: "组织", value: REPO_OWNER_ORG },
];
const GIT_OWNER_TYPE_ONLY = [
  {
    name: "个人",
    value: REPO_OWNER_USER,
  },
];
class Git {
  constructor(
    { name, version, dir },
    { refreshServer = false, refreshToken = false, refreshOwner = false }
  ) {
    this.name = name;
    this.version = version;
    this.dir = dir;
    this.git = SimpleGit(dir);
    this.gitServer = null;
    this.homePath = null;
    this.refreshServer = refreshServer;
    this.refreshToken = refreshToken;
    this.refreshOwner = refreshOwner;
    this.user = null;
    this.orgs = null;
    this.owner = null; //远程仓库类型
    this.login = null; //远程仓库登录名
    this.repo = null; //远程仓库信息
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
          terminalLink("点此链接跳转", this.gitServer?.getTokenUrl())
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
  async getUserAndOrgs() {
    this.user = await this.gitServer.getUser();
    if (!this.user) {
      throw new Error("用户信息获取失败");
    }
    this.orgs = await this.gitServer.getOrg(this.user.login);
  }
  async checkGitOwner() {
    const ownerPath = this.createPath(GIT_OWN_FILE);
    const loginPath = this.createPath(GIT_LOGIN_FILE);
    let owner = utils.readFile(ownerPath);
    let login = utils.readFile(loginPath);
    if (!owner || !login || this.refreshOwner) {
      owner = (
        await inquirer.prompt({
          type: "list",
          message: "请选择远程仓库类型",
          default: REPO_OWNER_USER,
          name: "owner",
          choices: this.orgs.length > 0 ? GIT_OWNER_TYPE : GIT_OWNER_TYPE_ONLY,
        })
      ).owner;
      if (owner === REPO_OWNER_USER) {
        login = this.user.login;
      } else {
        login = (
          await inquirer.prompt({
            type: "list",
            message: "请选择",
            name: "login",
            choices: this.orgs.map((item) => ({
              name: item.login,
              value: item.login,
            })),
          })
        ).login;
      }
      utils.writeFile(ownerPath, owner);
      console.log(`owner 写入成功 ${owner} -> ${ownerPath}`);

      utils.writeFile(loginPath, login);
      console.log(`login 写入成功 ${login} -> ${loginPath}`);
    }
    this.owner = owner;
    this.login = login;
  }
  async checkRepo() {
    let repo = await this.gitServer.getRepo(this.login, this.name);
    if (!repo) {
      let spinner = utils.spinnerStart("开始创建远程仓库");
      try {
        if (this.owner === REPO_OWNER_USER) {
          repo = await this.gitServer.createRepo(this.name);
        } else {
          repo = await this.gitServer.createOrgRepo(this.name, this.login);
        }
        console.log("创建远程仓库成功");
      } catch (e) {
        console.log("create repo error", e);
      } finally {
        spinner.stop(true);
      }
      if (!repo) {
        throw new Error("远程仓库创建失败");
      }
    }
    this.repo = repo;
  }
  checkGitIgnore() {
    const gitIgnore = path.resolve(this.dir, GIT_IGOREE_FILE);
    if (!fs.existsSync(gitIgnore)) {
      utils.writeFile(
        gitIgnore,
        `node_modules
/dist
/.DS_Store
        `
      );
      console.log("自动写入gitignore成功");
    }
  }
  async prepare() {
    // 检查缓存住目录
    this.checkHomePath();
    // 检查用户远程仓库类型
    await this.checkGitServer();
    await this.checkGitToken(); //获取远程仓库token
    await this.getUserAndOrgs(); //获取远程仓库用户和组织信息
    await this.checkGitOwner(); //获取远程仓库用户和组织信息
    await this.checkRepo(); // 检查并创建远程仓库
    this.checkGitIgnore(); //检查并创建.gitignore
  }
  async init() {
    await this.prepare();
    if (await this.getReomte()) {
      return;
    }

    await this.initAndAddRemote();
    await this.initCommit();
  }
  getReomte() {
    const gitPath = path.resolve(this.dir, GIT_ROOT_DIR);
    this.remote = this.gitServer.getRemote(this.login, this.name);
    if (fs.existsSync(gitPath)) {
      return true;
    }
  }
  async initCommit() {
    await this.checkConflicted(); //检查是否冲突
    await this.checkNotCommitted(); //检查是否未提交
    if (await this.checkRemoteMaster()) {
      await this.pullRemoteRepo("master", {
        "--allow-unrelated-histories": null,
        "--no-rebase": null,
      });
    } else {
      await this.pushRemoteRepo("master");
    }
  }
  async checkRemoteMaster() {
    return (
      (await this.git.listRemote(["--refs"])).indexOf("refs/heads/master") >= 0
    );
  }
  async pullRemoteRepo(branchName, options) {
    //同步远程branchName代码
    await this.git.pull("origin", branchName, options).catch((err) => {
      console.log("err=", err);
    });
  }
  async pushRemoteRepo(branchName) {
    await this.git.push("origin", branchName);
    console.log(`==== 推送代码到${branchName}分支成功`);
  }
  async checkConflicted() {
    const status = await this.git.status();
    if (status.conflicted.length > 0) {
      throw new Error("当前代码存在冲突,请手动处理");
    }
  }
  async checkNotCommitted() {
    const status = await this.git.status();
    if (
      status.not_added.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0 ||
      status.modified.length > 0 ||
      status.renamed.length > 0
    ) {
      await this.git.add(status.not_added);
      await this.git.add(status.created);
      await this.git.add(status.deleted);
      await this.git.add(status.modified);
      await this.git.add(status.renamed);
      let message;
      while (!message) {
        message = (
          await inquirer.prompt({
            type: "text",
            message: "请输入commit信息",
            name: "message",
          })
        ).message;
      }
      await this.git.commit(message);
      console.log("====本地commit提交成功====");
    }
  }
  async initAndAddRemote() {
    console.log("====开始执行Git初始化 ===== ");
    await this.git.init(this.dir);
    const remotes = await this.git.getRemotes();
    if (!remotes.find((item) => item.name === "origin")) {
      await this.git.addRemote("origin", this.remote);
    }
  }
}
module.exports = Git;
