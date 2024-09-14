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
    .catch((err1) => {
      return Promise.reject(err1);
    });
}
const getDefaultRegistry = (isOrigin = false) => {
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
      return semver.gt(b, a) ? 1 : -1;
    });
};
const getNpmSemverVersion = async (baseVersion, npmName, registry) => {
  const versions = await getNpmVersions(npmName, registry);
  const newVersions = getSemverVersion(baseVersion, versions);
  if (newVersions && newVersions?.length > 0) {
    return newVersions[0];
  }
};
const getNpmLatestVersion = async (npmName, registry) => {
  const versions = await getNpmVersions(npmName, registry);
  if (versions) {
    const version = versions.sort((a, b) => {
      return semver.gt(b, a) ? 1 : -1;
    })[0];
    return version;
  }
  return null;
};
module.exports = {
  getNpmInfo,
  getNpmVersions,
  getNpmSemverVersion,
  getDefaultRegistry,
  getNpmLatestVersion,
};
