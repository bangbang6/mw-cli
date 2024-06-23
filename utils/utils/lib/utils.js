"use strict";

const isObject = (o) => {
  return Object.prototype.toString.call(o) === "[object Object]";
};
function spinnerStart(msg, spinnerString = "|/-\\") {
  const Spinner = require("cli-spinner").Spinner;
  const spinner = new Spinner(msg + " %s");
  spinner.setSpinnerString(spinnerString);
  spinner.start();
  return spinner;
}
function sleep(timeout = 1000) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}
const exec = (command, args, options) => {
  const win32 = process.platform === "win32";
  const cmd = win32 ? "cmd" : command; // windows 下 cmd才是可执行文件
  const cmdArgs = win32 ? ["/c"].concat(command, args) : args; //// windows 下 /c表示 静莫执行
  return require("child_process").spawn(cmd, cmdArgs, options || {});
};
const execSync = (command, args, options) => {
  return new Promise((resolve, reject) => {
    const p = exec(command, args, options);
    p.on("error", (e) => reject(e));
    p.on("exit", (c) => resolve(c));
  });
};
module.exports = {
  isObject,
  spinnerStart,
  sleep,
  exec,
  execSync,
};
