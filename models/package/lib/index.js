"use strict";

/** npm包对应我们内部的类 */

const { isObject } = require("@mw-cli-dev/utils");
const pkgDir = require("pkg-dir").sync;
const path = require("path");
const formatPath = require("@mw-cli-dev/format-path");
const npmInstall = require("npminstall");
const {
  getDefaultRegistry,
  getNpmLatestVersion,
} = require("@mw-cli-dev/get-npm-info");
const pathExists = require("path-exists").sync;
const fse = require("fs-extra");

class Package {
  constructor(options) {
    if (!options) {
      throw new Error("Package类的参数不能为空");
    }
    if (!isObject(options)) {
      throw new Error("Package类的参数必须为对象");
    }
    /** 在命令行指定了init包的路径 */
    this.targetPath = options.targetPath;
    /** 缓存在.mac-mw-cli-dev的init包路径目录 */

    this.storeDir = options.storeDir;
    /** npm包的name */
    this.packageName = options.name;
    /** npm包的version */
    this.packageVersion = options.version;
    /** 缓存目录前缀 */
    this.cacheFilePathPrefix = this.packageName.replace("/", "_");
  }

  async prepare() {
    if (this.storeDir && !pathExists(this.storeDir)) {
      fse.mkdirpSync(this.storeDir);
    }
    if (this.packageVersion === "latest") {
      this.packageVersion = await getNpmLatestVersion(this.packageName);
    }
  }
  /** 缓存包的路径 */
  get cacheFilePath() {
    return path.resolve(
      this.storeDir,
      `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`
    );
  }
  getSpecificCacheFilePath(packageVersion) {
    return path.resolve(
      this.storeDir,
      `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`
    );
  }
  /** 判断当前包是否存在 */
  async exits() {
    /** 当这个存在的时候就是缓存模式 看缓存文件的node_modules里面包是否存在 */
    if (this.storeDir) {
      await this.prepare();
      return pathExists(this.cacheFilePath);
    } else {
      /** 否则是用targetPath指定的模式 直接看本地是否有这个目录 */
      return pathExists(this.targetPath);
    }
  }
  async install() {
    await this.prepare();
    return npmInstall({
      root: this.targetPath, //模块路径
      storeDir: this.storeDir, //实际存储的未知
      registry: getDefaultRegistry(),
      pkgs: [{ name: this.packageName, version: this.packageVersion }],
    });
  }
  async update() {
    await this.prepare();
    const latestPackageVersion = await getNpmLatestVersion(this.packageName);
    const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion);
    if (!pathExists(latestFilePath)) {
      await npmInstall({
        root: this.targetPath, //模块路径
        storeDir: this.storeDir, //实际存储的未知
        registry: getDefaultRegistry(),
        pkgs: [{ name: this.packageName, version: latestPackageVersion }],
      });
      console.log(
        `已经自动为你安装最新版本的${this.packageName}@${latestPackageVersion}`
      );
      this.packageVersion = latestPackageVersion;
    }
    return latestFilePath;
  }
  /** 获取包的入口文件 */
  getRootFilePath() {
    /** 获取package.json所在的目录  */
    /** require拿到package.json的main和lib */
    /** 路径的兼容 macos / windows */
    const getRootFile = (targetPath) => {
      const dir = pkgDir(targetPath);
      if (dir) {
        const pkgFile = require(path.resolve(dir, "package.json"));
        if (pkgFile && pkgFile.main) {
          return formatPath(path.resolve(dir, pkgFile.main));
        }
      }
      return null;
    };
    if (this.storeDir) {
      return getRootFile(this.cacheFilePath);
    } else {
      return getRootFile(this.targetPath);
    }
  }
}
module.exports = Package;
