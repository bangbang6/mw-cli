"use strict";
const io = require("socket.io-client");
const get = require("lodash/get");
const request = require("@mac-mw-cli-dev/request");
const inquirer = require("inquirer");
// const socket = require("socket.io-client")("http://127.0.0.1:7001");
// socket.on("connect", () => {
//   console.log("1");
//   socket.emit("chat", "hello");
// });
// socket.on("res", (mes) => {
//   socket.emit("chat12", msg);
// });
const FAILED_CODE = [
  "prepare failed",
  "install failed",
  "download failed",
  "build failed",
  "pre-publish failed",
  "publish failed",
];
const TIME_OUT = 5 * 60 * 1000;
const CONNECT_TIME_OUT = 5 * 60 * 1000;
const WS_SERVER = "http://www.loveyc-dev.cc:7001";
function parseMsg(msg) {
  const action = get(msg, "data.action");
  const message = get(msg, "data.payload.message");
  return {
    action,
    message,
  };
}
class CloudBuild {
  constructor(git, options) {
    this.buildCmd = options.buildCmd;
    this.timeout = TIME_OUT;
    this.git = git;
    this.prod = options.prod;
  }
  async prepare() {
    // 获取oss文件
    if (this.prod) {
      const name = this.git.name;
      const projectType = this.prod ? "prod" : "dev";
      const ossFiles = await request({
        url: `/project/oss`,
        params: {
          name,
          type: projectType,
        },
      });
      if (ossFiles.code === 0 && ossFiles.data.length > 0) {
        const cover = (
          await inquirer.prompt({
            type: "list",
            choices: [
              {
                name: "覆盖发布",
                value: true,
              },
              {
                name: "放弃发布",
                value: false,
              },
            ],
            defaultValue: true,
            name: "cover",
            message: `OSS已经存在[${name}]项目,是否覆盖发布`,
          })
        ).cover;
        if (!cover) {
          throw new Error("发布终止");
        }
      }
    }
    // 判断当前项目的oss文件是否存在
    // 如果存在且处于正式发布的时候,询问是否覆盖安装
  }
  async init() {
    return new Promise((resolve, reject) => {
      const socket = io(WS_SERVER, {
        query: {
          repo: this.git.remote,
          name: this.git.name,
          branch: this.git.branch,
          version: this.git.version,
          buildCmd: this.buildCmd,
          prod: this.prod,
        },
      });
      const disconnect = () => {
        clearTimeout(this.timer);
        socket.disconnect();
        socket.close();
      };
      socket.on("connect", () => {
        const { id } = socket;
        socket.on(id, (msg) => {
          const parsedMsg = parseMsg(msg);
        });
        this.timer && clearTimeout(this.timer);
        socket.on("disconnect", () => {
          console.log("云构建任务断开");
          disconnect();
        });
        socket.on("error", (err) => {
          console.log("云构建出错" + err);
          reject(err);
        });
        resolve();
      });
      this.socket = socket;
      this.timeoutFn(() => {
        console.log("云构建服务链接超时,自动终止");
        disconnect();
      }, CONNECT_TIME_OUT);
    });
  }
  async build() {
    let ret = true;
    return new Promise((resolve, reject) => {
      this.socket.emit("build");
      this.socket.on("build", (msg) => {
        const parsedMsg = parseMsg(msg);
        if (FAILED_CODE.indexOf(parsedMsg.action) >= 0) {
          console.log("error===", parsedMsg.message);
          this.timer && clearTimeout(this.timer);
          this.socket.disconnect();
          this.socket.close();
          ret = false;
        } else {
          console.log(parsedMsg.message);
        }
      });
      this.socket.on("building", (msg) => {
        console.log("building", msg);
      });
      this.socket.on("disconnect", () => {
        resolve(ret);
      });
      this.socket.on("error", (err) => {
        reject(err);
      });
    });
  }
  timeoutFn(fn, timeout) {
    this.timer && clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      fn();
    }, timeout);
  }
}
module.exports = CloudBuild;
console.log("test");
