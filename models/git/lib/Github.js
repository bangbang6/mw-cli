const { error } = require("../../../utils/log/lib");
const GitServer = require("./GitServer");
const GithubRequest = require("./GithubRequest");

class Github extends GitServer {
  constructor() {
    super("github");
    this.request = null;
  }
  setToken(token) {
    super.setToken(token);
    this.request = new GithubRequest(token);
  }
  getTokenHelpUrl() {
    return "https://docs.github.com/en/github/authenticating-to-github/connection-to-github-with-ssh";
  }
  getTokenUrl() {
    return "https://github.com/settings/tokens";
  }
  getUser() {
    return this.request.get("/user");
  }
  getOrg() {
    return this.request.get(`/user/orgs`, {
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
    return this.request.post(
      "/user/repos",
      {
        name,
      },
      { Accept: "application/vnd.github.v3+json" }
    );
  }
  createOrgRepo(name, login) {
    return this.request.post(
      `/orgs/${login}/repos`,
      {
        name,
      },
      { Accept: "application/vnd.github.v3+json" }
    );
  }
  getRemote(login, name) {
    return `git@github.com:${login}/${name}.git`;
  }
}
module.exports = Github;
