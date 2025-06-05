function error(methodName) {
  throw new Error(`${methodName} must be implemented`);
}
class GitServer {
  constructor(type, token) {
    this.type = type;
    this.token = token;
  }
  setToken(token) {
    this.token = token;
  }
  createRepo() {
    error("createRepo");
  }
  createOrgRepo() {
    error("createOrgRepo");
  }
  getRemote() {
    error("getRemote");
  }
  getRepo(login, name) {
    error("getReop");
  }
  getUser() {
    error("getUser");
  }
  getOrg() {
    error("getOrg");
  }
  getTokenHelpUrl() {
    error("getTokenHelpUrl");
  }
  getTokenUrl() {
    error("getTokenUrl");
  }
  isHttpResponse = (res) => {
    return res && res.status;
  };
  handleResponse = (res) => {
    if (
      this.isHttpResponse(res) &&
      res.status !== 200 &&
      res.status !== "开始"
    ) {
      return null;
    }
    return res;
  };
}
module.exports = GitServer;
