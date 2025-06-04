const { error } = require("../../../utils/log/lib");
const GitServer = require("./GitServer");

class Github extends GitServer {
  constructor() {
    super("github");
  }
  setToken() {}
  getTokenHelpUrl() {
    return "https://docs.github.com/en/github/authenticating-to-github/connection-to-github-with-ssh";
  }
  getSSHKeyUrl() {
    return "https://github.com/settings/keys";
  }
}
module.exports = Github;
