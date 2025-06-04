const GitServer = require("./GitServer");

class Gitee extends GitServer {
  constructor() {
    super("gitee");
  }
  setToken() {}
  getTokenHelpUrl() {
    return "https://gitee.com/help/articles/4191";
  }
  getSSHKeyUrl() {
    return "https://gitee.com/profile/sshkeys";
  }
}
module.exports = Gitee;
