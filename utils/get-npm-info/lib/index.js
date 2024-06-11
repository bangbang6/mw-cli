"use strict";

const axios = require("axios");
const semver = require("semver");
const urlJoin = require("url-join");

function getNpmInfo(npmName, registry) {
  if (!npmName) {
    return null;
  }
  const registryTemp = registry || getDefaultRegistry();
  const npminfoUrl = urlJoin(registryTemp, npmName);
  return axios
    .get(npminfoUrl)
    .then((res) => {
      if (res.status === 200) {
        return res.data;
      }
      return null;
    })
    .catch((err) => {
      return Promise.reject(err);
    });
}
const getDefaultRegistry = (isOrigin = true) => {
  return isOrigin
    ? "https://registry.npmjs.org"
    : "https://registry.npmmirror.com/";
};

const getNpmVersions = async (appName, registry) => {
  const data = await getNpmInfo(appName, registry);
  if (data) {
    return Object.keys(data.versions);
  } else {
    return [];
  }
};
/** 获取满足条件的版本号 */
const getSemverVersion = (baseVersion, versions) => {
  return versions
    .filter((version) => semver.satisfies(version, `^${baseVersion}`))
    .sort((a, b) => {
      return semver.gt(b, a);
    });
};
const getNpmSemverVersion = async (baseVersion, npmName, registry) => {
  const versions = await getNpmVersions(npmName, registry);
  const newVersions = getSemverVersion(baseVersion, versions);
  if (newVersions && newVersions?.length > 0) {
    return newVersions[0];
  }
};
module.exports = {
  getNpmInfo,
  getNpmVersions,
  getNpmSemverVersion,
};
