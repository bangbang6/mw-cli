"use strict";
const SimpleGit = require("simple-git");
const userHome = require("user-home");
const semver = require("semver");
const utils = require("@mac-mw-cli-dev/utils");
const CloudBuild = require("@mac-mw-cli-dev/cloudbuild");
const path = require("path");
const fse = require("fs-extra");
const fs = require("fs");
const inquirer = require("inquirer");
const terminalLink = require("terminal-link");
const { DEFAULT_CLI_HOME } = require("../../../core/cli/lib/const");
const Github = require("./Github");
const Gitee = require("./Gitee");
const { log } = require("console");
const request = require("@mac-mw-cli-dev/request");
const GIT_SERVER_FILE = ".git_server";
const GIT_Token_FILE = ".git_token";
const GIT_ROOT_DIR = ".git";
const GIT_PUBLISH_FILE = ".git_publish";
const GITHUB = "github";
const GITEE = "gitee";
const GIT_OWN_FILE = ".git_own";
const GIT_LOGIN_FILE = ".git_login";
const REPO_OWNER_USER = "user";
const REPO_OWNER_ORG = "org";
const GIT_IGOREE_FILE = ".gitignore";
const VERSION_RELEASE = "release";
const VERSION_DEV = "dev";
const TEMPLATE_TMP_DIR = "oss";
const GIT_PUBLISH_TYPE = [
  {
    name: "OSS",
    value: "oss",
  },
];
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
    {
      refreshServer = false,
      refreshToken = false,
      refreshOwner = false,
      buildCmd = "npm run build",
      prod = false,
      sshUser = "",
      sshIp = "",
      sshPath = "",
    }
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
    this.buildCmd = buildCmd; //构建命令
    this.user = null;
    this.orgs = null;
    this.owner = null; //远程仓库类型
    this.login = null; //远程仓库登录名
    this.repo = null; //远程仓库信息
    this.branch = null;
    this.gitPublish = null;
    this.prod = prod;
    this.sshUser = sshUser;
    this.sshIp = sshIp;
    this.sshPath = sshPath;
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
      return true;
    }
    await this.initAndAddRemote();

    await this.initCommit();
  }
  async commit() {
    // 生成开发分支---当前位于master分支或者其他分支在init阶段合并过master分支
    await this.getCorrectVersion();
    // 检查stash区
    await this.checkStash();
    // 检查代码冲突
    await this.checkConflicted();
    // 检查未提交代码
    await this.checkNotCommitted();
    // 切换开发分支
    await this.checkoutBranch(this.branch);
    // 合并远程master和开发分支
    await this.pullRemoteMasterAndBranch();
    // 推送代码到远程仓库
    await this.pushRemoteRepo(this.branch);
  }
  async publish() {
    await this.preparePublish();
    const cloudBuild = new CloudBuild(this, {
      buildCmd: this.buildCmd,
      type: this.gitPublish,
      prod: this.prod,
    });
    await cloudBuild.prepare();
    await cloudBuild.init();
    const ret = await cloudBuild.build();
    console.log("ret", ret);
    if (ret) {
      await this.uploadTemplate();
    }
    if (this.prod && ret) {
      // 打tag
      await this.checkTag();
      // 切到master
      await this.checkoutBranch("master");
      // 开发分支合并打omaster
      await this.mergeBranchMaster();
      // 将代码推送到远程
      await this.pushRemoteRepo("master");
      // 删除本地开发分支
      await this.deleteLocalBranch();
      // 删除远程开发分支
      await this.deleteRemoteBranch();
    }
  }
  async mergeBranchMaster() {
    console.log(`开始合并代码,${this.branch}->[master]`);
    await this.git.mergeFromTo(this.branch, "master");
    console.log(`代码合并成功,${this.branch}->[master]`);
  }
  async deleteLocalBranch() {
    console.log("开始删除本地开发分支" + this.branch);
    await this.git.deleteLocalBranch(this.branch);
  }
  async deleteRemoteBranch() {
    console.log("开始删除远程开发分支" + this.branch);
    await this.git.push(["origin", "--delete", this.branch]);
  }
  async checkTag() {
    console.log("获取远程tag列表");
    const tag = `${VERSION_RELEASE}/${this.version}`;
    const tagList = await this.getRemoteBranchList(VERSION_RELEASE);
    console.log("tagList", tagList);
    if (tagList.includes(this.version)) {
      console.log("远程分支存在 删除远程分支");
      await this.git.push(["origin", `:refs/tags/${tag}`]);
    }
    const localTagList = await this.git.tags();
    if (localTagList.all.includes(tag)) {
      console.log("本地tag存在,正在删除");
      await this.git, tag(["-d", tag]);
    }
    await this.git.addTag(tag);
    console.log("本地tag创建成功");
    await this.git.pushTags("origin", tag);
    console.log("远程tag创建成功");
  }
  // history路由需要上传html到服务器
  async uploadTemplate() {
    if (this.sshIp && this.sshUser && this.sshPath) {
      console.log("开始下载模板文件");
      let ossTemplate = await request({
        url: "/oss/get",
        params: {
          name: this.name,
          file: "index.html",
          type: this.prod ? "prod" : "dev",
        },
      });
      if (ossTemplate.code === 0 && ossTemplate.data) {
        ossTemplate = ossTemplate.data;
      }
      let response = await request({
        url: ossTemplate.url,
      });
      if (response) {
        const ossTempDIr = path.resolve(
          this.homePath,
          TEMPLATE_TMP_DIR,
          `${this.name}@${this.version}`
        );
        if (!fs.existsSync(ossTempDIr)) {
          fse.mkdirpSync(ossTempDIr);
        } else {
          fse.emptyDirSync(ossTempDIr);
        }
        const templateFilePath = path.resolve(ossTempDIr, "index.html");
        fse.createFileSync(templateFilePath);
        fs.writeFileSync(templateFilePath, response);
        console.log("模板文件下载成功" + templateFilePath);
        const uploadCmd = `scp -r ${templateFilePath} ${this.sshUser}@${this.sshIp}:${this.sshPath}`;
        const ret = require("child_process").execSync(uploadCmd);
        console.log("ret", ret.toString());
        console.log("模板文件上传成功" + templateFilePath);
        fse.emptyDirSync(ossTempDIr);
      }
    }
  }
  async preparePublish() {
    const pkg = this.getPackageJson();
    if (this.buildCmd) {
      const buildCmdArray = this.buildCmd.split(" ");
      console.log("buildCmdArray", buildCmdArray);
      if (
        !(
          buildCmdArray[0] === "npm" ||
          buildCmdArray[0] === "cnpm" ||
          buildCmdArray[0] === "yarn"
        )
      ) {
        throw new Error("Build命令非法");
      }
    }
    const buildCmdArray = this.buildCmd.split(" ");

    const lastCommand = buildCmdArray[buildCmdArray.length - 1];
    if (!pkg.scripts || !Object.keys(pkg.scripts).includes(lastCommand)) {
      throw new Error(`${this.buildCmd} 命令不存在`);
    }
    console.log("云发布预检查通过");
    const gitPublishPath = this.createPath(GIT_PUBLISH_FILE);
    let gitPublish = utils.readFile(gitPublishPath);
    if (!gitPublish) {
      gitPublish = (
        await inquirer.prompt({
          type: "list",
          message: "请选择想要上传代码的平台",
          name: "gitPublish",
          choices: GIT_PUBLISH_TYPE,
          default: "oss",
        })
      ).gitPublish;
      utils.writeFile(gitPublishPath, gitPublish);
      this.gitPublish = gitPublish;
      console.log("git publish类型写入成功");
    }
  }
  getPackageJson() {
    const pkgPath = path.resolve(this.dir, "package.json");
    if (!fs.existsSync(pkgPath)) {
      throw new Error("package json不存在");
    }
    return fse.readJSONSync(pkgPath);
  }
  async pullRemoteMasterAndBranch() {
    console.log("合并master ->" + this.branch);
    await this.pullRemoteRepo("master");
    await this.checkConflicted();
    const remoteBranchList = await this.getRemoteBranchList(VERSION_DEV);
    if (remoteBranchList.indexOf(this.version) >= 0) {
      console.log(`合并远程分支[${this.branch}]`);
      await this.checkConflicted();
    } else {
      console.log(`不存在远程分支[${this.branch}]`);
    }
  }
  async checkoutBranch(branch) {
    const localBranchList = await this.git.branchLocal();
    if (localBranchList.all.indexOf(branch) >= 0) {
      await this.git.checkout(branch);
    } else {
      await this.git.checkoutLocalBranch(branch);
    }
    console.log("分支切换到" + branch);
  }
  async checkStash() {
    const stashList = await this.git.stashList();
    if (stashList.all.length > 0) {
      await this.git.stash(["pop"]);
      console.log("stash pop 成功");
    }
  }
  async getCorrectVersion() {
    // 获取远程线上分支号 tags
    // tags规范release/x.y.z dev/x.y.z
    const remoteBranchList = await this.getRemoteBranchList(VERSION_RELEASE);
    let releaseVersion = null;
    if (remoteBranchList && remoteBranchList.length > 0) {
      releaseVersion = remoteBranchList[0];
    }
    const devVersion = this.version;
    if (!releaseVersion) {
      this.branch = `${VERSION_DEV}/${devVersion}`;
    } else if (semver.gt(this.version, releaseVersion)) {
      console.log("当前本地版本大于线上最新版本");
      this.branch = `${VERSION_DEV}/${devVersion}`;
    } else {
      console.log("当前线上版本大于本地版本");
      const incType = (
        await inquirer.prompt({
          type: "list",
          message: "请选择版本升级类型",
          name: "incType",
          choices: [
            {
              name: `小版本(${releaseVersion} -> ${semver.inc(
                releaseVersion,
                "patch"
              )})`,
              value: "patch",
            },
            {
              name: `中版本(${releaseVersion} -> ${semver.inc(
                releaseVersion,
                "minor"
              )})`,
              value: "minor",
            },
            {
              name: `大版本(${releaseVersion} -> ${semver.inc(
                releaseVersion,
                "major"
              )})`,
              value: "major",
            },
          ],
        })
      ).incType;
      const incVersion = semver.inc(releaseVersion, incType);
      this.branch = `${VERSION_DEV}/${incVersion}`;
      this.version = incVersion;
    }
    // 3.将version同步到package.json
    this.syncVersionToPackageJson();
  }
  syncVersionToPackageJson() {
    const pkg = fse.readJSONSync(`${this.dir}/package.json`);
    if (pkg && pkg.version !== this.version) {
      pkg.version = this.version;
      fse.writeJsonSync(`${this.dir}/package.json`, pkg, { spaces: 2 });
    }
  }
  async getRemoteBranchList(type) {
    const remoteList = await this.git.listRemote(["--refs"]);
    let reg;
    if (type === VERSION_RELEASE) {
      reg = /.+?refs\/tags\/release\/(\d+\.\d+\.\d+)/g;
    } else if (type === VERSION_DEV) {
      reg = /.+?refs\/heads\/dev\/(\d+\.\d+\.\d+)/g;
    }
    return remoteList
      .split("\n")
      .map((remote) => {
        const match = reg.exec(remote);
        reg.lastIndex = 1;
        if (match && semver.valid(match[1])) {
          return match[1];
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (semver.lte(b, a)) {
          if (a === b) {
            return 0;
          }
          return -1;
        }
        return 1;
      });
  }
  getReomte() {
    const gitPath = path.resolve(this.dir, GIT_ROOT_DIR);
    this.remote = this.gitServer.getRemote(this.login, this.name);
    if (fs.existsSync(gitPath) && this.remote) {
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
    try {
      const gitBranch = await this.git.listRemote(["--refs"]);
      if (!gitBranch) {
        return false;
      } else {
        return (
          (await this.git.listRemote(["--refs"])).indexOf(
            "refs/heads/master"
          ) >= 0
        );
      }
    } catch (e) {
      return false;
    }
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
