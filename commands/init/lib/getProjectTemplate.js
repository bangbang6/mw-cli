const request = require("@mac-mw-cli-dev/request");
module.exports = function () {
  return request({
    url: "/project/template",
  });
};
