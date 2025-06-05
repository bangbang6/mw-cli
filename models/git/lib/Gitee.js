const GitServer = require("./GitServer");
const GiteeRequest = require("./GiteeRequest");

class Gitee extends GitServer {
  constructor() {
    super("gitee");
    this.request = null;
  }
  setToken(token) {
    super.setToken(token);
    this.request = new GiteeRequest(token);
  }
  getTokenHelpUrl() {
    return "https://gitee.com/help/articles/4191";
  }
  getTokenUrl() {
    return "https://gitee.com/";
  }
  getUser() {
    return this.request.get("/user");
  }
  getOrg(username) {
    return this.request.get(`/users/${username}/orgs`, {
      page: 1,
      per_page: 100,
    });
  }
  getRepo(login, name) {
    return this.request.get(`/repos/${login}/${name}`).then((res) => {
      return this.handleResponse(res);
    });
  }
  createRepo(name) {
    return this.request.post("/user/repos", {
      name,
    });
  }
  createOrgRepo(name, login) {
    return this.request.post(`/orgs/${login}/repos`, {
      name,
    });
  }
  getRemote(login, name) {
    return `git@gitee.com:${login}/${name}.git`;
  }
}
module.exports = Gitee;
