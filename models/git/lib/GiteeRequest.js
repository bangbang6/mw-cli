const axios = require("axios");
const BASE_URL = "https://gitee.com/api/v5/";
class GiteeRequest {
  constructor(token) {
    this.token = token;
    this.service = axios.create({
      baseURL: BASE_URL,
      timeout: 5000,
    });

    this.service.interceptors.response.use(
      (response) => {
        return response.data;
      },
      (error) => {
        if (error.response && error.response.data) {
          return error.response;
        } else {
          return Promise.reject(error);
        }
      }
    );
  }
  get(url, params, headers) {
    return this.service({
      url,
      params: {
        ...params,
        access_token: this.token,
      },
      method: "get",
      headers,
    });
  }
  post(url, data, headers) {
    return this.service({
      url,
      params: {
        access_token: this.token,
      },
      headers,
      data,
      method: "post",
    });
  }
}
module.exports = GiteeRequest;
