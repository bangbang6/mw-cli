"use strict";
const fs = require("fs");
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
const readFile = (path, options = {}) => {
  if (fs.existsSync(path)) {
    const buffer = fs.readFileSync(path);
    if (buffer) {
      if (options.toJson) {
        return buffer.toJSON();
      } else {
        return buffer.toString();
      }
    }
  }
  return null;
};
const writeFile = (path, data, { rewrite = true } = {}) => {
  if (fs.existsSync(path)) {
    if (rewrite) {
      fs.writeFileSync(path, data);
      return true;
    }
    return false;
  } else {
    fs.writeFileSync(path, data);
    return true;
  }
};
module.exports = {
  isObject,
  spinnerStart,
  sleep,
  exec,
  execSync,
  readFile,
  writeFile,
};
