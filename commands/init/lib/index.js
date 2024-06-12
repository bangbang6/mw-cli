"use strict";

const index = (projectName, cmdObj) => {
  console.log(projectName, process.env.CLI_TARGET_PATH);
};

module.exports = index;
