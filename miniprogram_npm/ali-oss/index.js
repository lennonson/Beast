module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {}, _tempexports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = __MODS__[modId].m; m._exports = m._tempexports; var desp = Object.getOwnPropertyDescriptor(m, "exports"); if (desp && desp.configurable) Object.defineProperty(m, "exports", { set: function (val) { if(typeof val === "object" && val !== m._exports) { m._exports.__proto__ = val.__proto__; Object.keys(val).forEach(function (k) { m._exports[k] = val[k]; }); } m._tempexports = val }, get: function () { return m._tempexports; } }); __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1745133307236, function(require, module, exports) {
const debug = require('debug')('ali-oss');
const sendToWormhole = require('stream-wormhole');
const xml = require('xml2js');
const AgentKeepalive = require('agentkeepalive');
const HttpsAgentKeepalive = require('agentkeepalive').HttpsAgent;
const merge = require('merge-descriptors');
const platform = require('platform');
const utility = require('utility');
const urllib = require('urllib');
const pkg = require('../package.json');
const bowser = require('bowser');
const signUtils = require('./common/signUtils');
const _initOptions = require('./common/client/initOptions');
const { createRequest } = require('./common/utils/createRequest');
const { encoder } = require('./common/utils/encoder');
const { getReqUrl } = require('./common/client/getReqUrl');
const { setSTSToken } = require('./common/utils/setSTSToken');
const { retry } = require('./common/utils/retry');
const { isFunction } = require('./common/utils/isFunction');
const { getStandardRegion } = require('./common/utils/getStandardRegion');

const globalHttpAgent = new AgentKeepalive();
const globalHttpsAgent = new HttpsAgentKeepalive();

function Client(options, ctx) {
  if (!(this instanceof Client)) {
    return new Client(options, ctx);
  }

  if (options && options.inited) {
    this.options = options;
  } else {
    this.options = Client.initOptions(options);
  }

  // support custom agent and urllib client
  if (this.options.urllib) {
    this.urllib = this.options.urllib;
  } else {
    this.urllib = urllib;
    if (this.options.maxSockets) {
      globalHttpAgent.maxSockets = this.options.maxSockets;
      globalHttpsAgent.maxSockets = this.options.maxSockets;
    }
    this.agent = this.options.agent || globalHttpAgent;
    this.httpsAgent = this.options.httpsAgent || globalHttpsAgent;
  }
  this.ctx = ctx;
  this.userAgent = this._getUserAgent();
  this.stsTokenFreshTime = new Date();
}

/**
 * Expose `Client`
 */

module.exports = Client;

Client.initOptions = function initOptions(options) {
  return _initOptions(options);
};

/**
 * prototype
 */

const proto = Client.prototype;

/**
 * Object operations
 */
merge(proto, require('./common/object'));
merge(proto, require('./object'));
merge(proto, require('./common/image'));
/**
 * Bucket operations
 */
merge(proto, require('./common/bucket'));
merge(proto, require('./bucket'));
// multipart upload
merge(proto, require('./managed-upload'));
/**
 * RTMP operations
 */
merge(proto, require('./rtmp'));

/**
 * common multipart-copy support node and browser
 */
merge(proto, require('./common/multipart-copy'));
/**
 * Common module parallel
 */
merge(proto, require('./common/parallel'));
/**
 * Multipart operations
 */
merge(proto, require('./common/multipart'));
/**
 * ImageClient class
 */
Client.ImageClient = require('./image')(Client);
/**
 * Cluster Client class
 */
Client.ClusterClient = require('./cluster')(Client);

/**
 * STS Client class
 */
Client.STS = require('./sts');

/**
 * get OSS signature
 * @param {String} stringToSign
 * @return {String} the signature
 */
proto.signature = function signature(stringToSign) {
  debug('authorization stringToSign: %s', stringToSign);

  return signUtils.computeSignature(this.options.accessKeySecret, stringToSign, this.options.headerEncoding);
};

proto._getReqUrl = getReqUrl;

/**
 * get author header
 *
 * "Authorization: OSS " + Access Key Id + ":" + Signature
 *
 * Signature = base64(hmac-sha1(Access Key Secret + "\n"
 *  + VERB + "\n"
 *  + CONTENT-MD5 + "\n"
 *  + CONTENT-TYPE + "\n"
 *  + DATE + "\n"
 *  + CanonicalizedOSSHeaders
 *  + CanonicalizedResource))
 *
 * @param {String} method
 * @param {String} resource
 * @param {Object} header
 * @return {String}
 *
 * @api private
 */

proto.authorization = function authorization(method, resource, subres, headers) {
  const stringToSign = signUtils.buildCanonicalString(method.toUpperCase(), resource, {
    headers,
    parameters: subres
  });

  return signUtils.authorization(
    this.options.accessKeyId,
    this.options.accessKeySecret,
    stringToSign,
    this.options.headerEncoding
  );
};

/**
 * get authorization header v4
 *
 * @param {string} method
 * @param {Object} requestParams
 * @param {Object} requestParams.headers
 * @param {Object} [requestParams.queries]
 * @param {string} [bucketName]
 * @param {string} [objectName]
 * @param {string[]} [additionalHeaders]
 * @return {string}
 *
 * @api private
 */
proto.authorizationV4 = function authorizationV4(method, requestParams, bucketName, objectName, additionalHeaders) {
  return signUtils.authorizationV4(
    this.options.accessKeyId,
    this.options.accessKeySecret,
    getStandardRegion(this.options.region),
    method,
    requestParams,
    bucketName,
    objectName,
    additionalHeaders,
    this.options.headerEncoding
  );
};

/**
 * request oss server
 * @param {Object} params
 *   - {String} object
 *   - {String} bucket
 *   - {Object} [headers]
 *   - {Object} [query]
 *   - {Buffer} [content]
 *   - {Stream} [stream]
 *   - {Stream} [writeStream]
 *   - {String} [mime]
 *   - {Boolean} [xmlResponse]
 *   - {Boolean} [customResponse]
 *   - {Number} [timeout]
 *   - {Object} [ctx] request context, default is `this.ctx`
 *
 * @api private
 */

proto.request = async function (params) {
  if (this.options.retryMax) {
    return await retry(request.bind(this), this.options.retryMax, {
      errorHandler: err => {
        const _errHandle = _err => {
          if (params.stream) return false;
          const statusErr = [-1, -2].includes(_err.status);
          const requestErrorRetryHandle = this.options.requestErrorRetryHandle || (() => true);
          return statusErr && requestErrorRetryHandle(_err);
        };
        if (_errHandle(err)) return true;
        return false;
      }
    })(params);
  } else {
    return await request.call(this, params);
  }
};

async function request(params) {
  if (this.options.stsToken && isFunction(this.options.refreshSTSToken)) {
    await setSTSToken.call(this);
  }
  const reqParams = createRequest.call(this, params);
  let result;
  let reqErr;
  try {
    result = await this.urllib.request(reqParams.url, reqParams.params);
    debug('response %s %s, got %s, headers: %j', params.method, reqParams.url, result.status, result.headers);
  } catch (err) {
    reqErr = err;
  }
  let err;
  if (result && params.successStatuses && params.successStatuses.indexOf(result.status) === -1) {
    err = await this.requestError(result);
    err.params = params;
  } else if (reqErr) {
    err = await this.requestError(reqErr);
  }

  if (err) {
    if (params.customResponse && result && result.res) {
      // consume the response stream
      await sendToWormhole(result.res);
    }

    if (err.name === 'ResponseTimeoutError') {
      err.message = `${
        err.message.split(',')[0]
      }, please increase the timeout, see more details at https://github.com/ali-sdk/ali-oss#responsetimeouterror`;
    }
    if (err.name === 'ConnectionTimeoutError') {
      err.message = `${
        err.message.split(',')[0]
      }, please increase the timeout or reduce the partSize, see more details at https://github.com/ali-sdk/ali-oss#connectiontimeouterror`;
    }
    throw err;
  }

  if (params.xmlResponse) {
    result.data = await this.parseXML(result.data);
  }
  return result;
}

proto._getResource = function _getResource(params) {
  let resource = '/';
  if (params.bucket) resource += `${params.bucket}/`;
  if (params.object) resource += encoder(params.object, this.options.headerEncoding);

  return resource;
};

proto._escape = function _escape(name) {
  return utility.encodeURIComponent(name).replace(/%2F/g, '/');
};

/*
 * Get User-Agent for browser & node.js
 * @example
 *   aliyun-sdk-nodejs/4.1.2 Node.js 5.3.0 on Darwin 64-bit
 *   aliyun-sdk-js/4.1.2 Safari 9.0 on Apple iPhone(iOS 9.2.1)
 *   aliyun-sdk-js/4.1.2 Chrome 43.0.2357.134 32-bit on Windows Server 2008 R2 / 7 64-bit
 */

proto._getUserAgent = function _getUserAgent() {
  const agent = process && process.browser ? 'js' : 'nodejs';
  const sdk = `aliyun-sdk-${agent}/${pkg.version}`;
  let plat = platform.description;
  if (!plat && process) {
    plat = `Node.js ${process.version.slice(1)} on ${process.platform} ${process.arch}`;
  }

  return this._checkUserAgent(`${sdk} ${plat}`);
};

proto._checkUserAgent = function _checkUserAgent(ua) {
  const userAgent = ua.replace(/\u03b1/, 'alpha').replace(/\u03b2/, 'beta');
  return userAgent;
};

/*
 * Check Browser And Version
 * @param {String} [name] browser name: like IE, Chrome, Firefox
 * @param {String} [version] browser major version: like 10(IE 10.x), 55(Chrome 55.x), 50(Firefox 50.x)
 * @return {Bool} true or false
 * @api private
 */

proto.checkBrowserAndVersion = function checkBrowserAndVersion(name, version) {
  return bowser.name === name && bowser.version.split('.')[0] === version;
};

/**
 * thunkify xml.parseString
 * @param {String|Buffer} str
 *
 * @api private
 */

proto.parseXML = function parseXMLThunk(str) {
  return new Promise((resolve, reject) => {
    if (Buffer.isBuffer(str)) {
      str = str.toString();
    }
    xml.parseString(
      str,
      {
        explicitRoot: false,
        explicitArray: false
      },
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
};

/**
 * generater a request error with request response
 * @param {Object} result
 *
 * @api private
 */

proto.requestError = async function requestError(result) {
  let err = null;

  const setError = async message => {
    let info;
    try {
      info = (await this.parseXML(message)) || {};
    } catch (error) {
      debug(message);
      error.message += `\nraw xml: ${message}`;
      error.status = result.status;
      error.requestId = result.headers && result.headers['x-oss-request-id'];
      return error;
    }

    let msg = info.Message || `unknow request error, status: ${result.status}`;
    if (info.Condition) {
      msg += ` (condition: ${info.Condition})`;
    }
    err = new Error(msg);
    err.name = info.Code ? `${info.Code}Error` : 'UnknownError';
    err.status = result.status;
    err.code = info.Code;
    err.requestId = info.RequestId;
    err.ecCode = info.EC;
    err.hostId = info.HostId;
    return err;
  };

  if (result.name === 'ResponseTimeoutError') {
    err = new Error(result.message);
    err.name = result.name;
  } else if (!result.data || !result.data.length) {
    if (result.status === -1 || result.status === -2) {
      // -1 is net error , -2 is timeout
      err = new Error(result.message);
      err.name = result.name;
      err.status = result.status;
      err.code = result.name;
    } else {
      // HEAD not exists resource
      if (result.status === 404) {
        err = new Error('Object not exists');
        err.name = 'NoSuchKeyError';
        err.status = 404;
        err.code = 'NoSuchKey';
      } else if (result.status === 412) {
        err = new Error('Pre condition failed');
        err.name = 'PreconditionFailedError';
        err.status = 412;
        err.code = 'PreconditionFailed';
      } else {
        err = new Error(`Unknow error, status: ${result.status}`);
        err.name = 'UnknownError';
        err.status = result.status;
        err.res = result;
        const ossErr = result.headers && result.headers['x-oss-err'];
        if (ossErr) {
          const message = Buffer.from(ossErr, 'base64').toString('utf8');
          err = await setError(message);
        }
      }
      err.requestId = result.headers && result.headers['x-oss-request-id'];
      err.host = '';
    }
  } else {
    const message = String(result.data);
    debug('request response error data: %s', message);

    err = await setError(message);
  }

  debug('generate error %j', err);
  return err;
};

proto.setSLDEnabled = function setSLDEnabled(enable) {
  this.options.sldEnable = !!enable;
  return this;
};

}, function(modId) {var map = {"../package.json":1745133307237,"./common/signUtils":1745133307238,"./common/client/initOptions":1745133307242,"./common/utils/createRequest":1745133307246,"./common/utils/encoder":1745133307247,"./common/client/getReqUrl":1745133307249,"./common/utils/setSTSToken":1745133307251,"./common/utils/retry":1745133307253,"./common/utils/isFunction":1745133307254,"./common/utils/getStandardRegion":1745133307255,"./common/object":1745133307256,"./object":1745133307287,"./common/image":1745133307290,"./common/bucket":1745133307292,"./bucket":1745133307329,"./managed-upload":1745133307330,"./rtmp":1745133307332,"./common/multipart-copy":1745133307333,"./common/parallel":1745133307334,"./common/multipart":1745133307335,"./image":1745133307337,"./cluster":1745133307338,"./sts":1745133307339}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307237, function(require, module, exports) {
module.exports = {
  "name": "ali-oss",
  "version": "6.22.0",
  "description": "aliyun oss(object storage service) node client",
  "main": "./lib/client.js",
  "files": [
    "lib",
    "shims",
    "dist"
  ],
  "browser": {
    "./lib/client.js": "./dist/aliyun-oss-sdk.js",
    "mime": "mime/lite",
    "urllib": "./shims/xhr.js",
    "utility": "./shims/utility.js",
    "crypto": "./shims/crypto/crypto.js",
    "debug": "./shims/debug",
    "fs": false,
    "child_process": false,
    "is-type-of": "./shims/is-type-of.js"
  },
  "scripts": {
    "build-change-log": "standard-version",
    "test": "npm run tsc && mocha -t 120000 -r should -r dotenv/config test/node/*.test.js test/node/**/*.test.js",
    "test-cov": "npm run tsc && nyc --reporter=lcov node_modules/.bin/_mocha -t 120000 -r should test/node/*.test.js test/node/**/*.test.js",
    "jshint": "jshint .",
    "build-test": "mkdir -p ./test/browser/build && MINIFY=1 node browser-build.js > test/browser/build/aliyun-oss-sdk.min.js && node -r dotenv/config task/browser-test-build.js > test/browser/build/tests.js",
    "browser-test": "npm run build-test && karma start",
    "build-dist": "npm run tsc && node browser-build.js > dist/aliyun-oss-sdk.js && MINIFY=1 node browser-build.js > dist/aliyun-oss-sdk.min.js",
    "publish-to-npm": "node publish-npm-check.js && npm publish",
    "publish-to-cdn": "node publish.js",
    "snyk-protect": "snyk-protect",
    "lint-staged": "lint-staged",
    "detect-secrets": "node task/detect-secrets",
    "tsc": "npm run tsc:clean && npm run tsc:build",
    "tsc:build": "tsc -b tsconfig.json tsconfig-cjs.json",
    "tsc:watch": "tsc -b tsconfig.json tsconfig-cjs.json --watch",
    "tsc:clean": "tsc -b tsconfig.json tsconfig-cjs.json --clean ",
    "prepare": "husky install"
  },
  "git-pre-hooks": {
    "pre-release": "npm run build-dist",
    "post-release": [
      "npm run publish-to-npm",
      "npm run publish-to-cdn"
    ]
  },
  "homepage": "https://github.com/ali-sdk/ali-oss",
  "bugs": {
    "url": "https://github.com/ali-sdk/ali-oss/issues"
  },
  "publishConfig": {
    "registry": "https://registry.npmjs.org/",
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/ali-sdk/ali-oss.git"
  },
  "keywords": [
    "oss",
    "client",
    "file",
    "aliyun"
  ],
  "author": "dead_horse",
  "license": "MIT",
  "engines": {
    "node": ">=8"
  },
  "devDependencies": {
    "@alicloud/openapi-client": "^0.4.10",
    "@alicloud/resourcemanager20200331": "^2.3.0",
    "@alicloud/tea-util": "^1.4.9",
    "@babel/core": "^7.11.6",
    "@babel/plugin-transform-regenerator": "^7.10.4",
    "@babel/plugin-transform-runtime": "^7.11.5",
    "@babel/preset-env": "^7.11.5",
    "@babel/runtime": "^7.11.2",
    "@commitlint/cli": "^17.6.7",
    "@commitlint/config-conventional": "^16.2.4",
    "@octokit/core": "^5.0.0",
    "@semantic-release/exec": "^6.0.3",
    "@semantic-release/git": "^10.0.1",
    "@semantic-release/npm": "^10.0.5",
    "@snyk/protect": "^1.1196.0",
    "@types/node": "^14.0.12",
    "@typescript-eslint/eslint-plugin": "^5.0.0",
    "@typescript-eslint/parser": "^5.0.0",
    "aliasify": "^2.0.0",
    "axios": "^0.27.2",
    "babelify": "^10.0.0",
    "beautify-benchmark": "^0.2.4",
    "benchmark": "^2.1.1",
    "bluebird": "^3.1.5",
    "browserify": "^17.0.0",
    "core-js": "^3.6.5",
    "crypto-js": "^4.2.0",
    "dotenv": "^8.2.0",
    "eslint": "^8.44.0",
    "eslint-config-airbnb": "^19.0.4",
    "eslint-config-ali": "^13.0.0",
    "eslint-config-prettier": "^8.8.0",
    "eslint-plugin-import": "^2.21.1",
    "eslint-plugin-jsx-a11y": "^6.0.3",
    "eslint-plugin-prettier": "^4.2.1",
    "filereader": "^0.10.3",
    "form-data": "^4.0.0",
    "git-pre-hooks": "^1.2.0",
    "husky": "^7.0.4",
    "immediate": "^3.3.0",
    "karma": "^6.3.4",
    "karma-browserify": "^8.1.0",
    "karma-chrome-launcher": "^2.2.0",
    "karma-firefox-launcher": "^1.0.1",
    "karma-ie-launcher": "^1.0.0",
    "karma-mocha": "^2.0.1",
    "karma-safari-launcher": "^1.0.0",
    "lint-staged": "^12.4.1",
    "mm": "^2.0.0",
    "mocha": "^9.1.2",
    "nise": "5.1.4",
    "nyc": "^15.1.0",
    "prettier": "^3.0.0",
    "promise-polyfill": "^6.0.2",
    "puppeteer": "19.0.0",
    "semantic-release": "^21.1.1",
    "should": "^11.0.0",
    "sinon": "^15.2.0",
    "standard-version": "^9.3.1",
    "stream-equal": "^1.1.0",
    "timemachine": "^0.3.0",
    "typescript": "^3.9.5",
    "uglify-js": "^3.14.2",
    "watchify": "^4.0.0"
  },
  "dependencies": {
    "address": "^1.2.2",
    "agentkeepalive": "^3.4.1",
    "bowser": "^1.6.0",
    "copy-to": "^2.0.1",
    "dateformat": "^2.0.0",
    "debug": "^4.3.4",
    "destroy": "^1.0.4",
    "end-or-error": "^1.0.1",
    "get-ready": "^1.0.0",
    "humanize-ms": "^1.2.0",
    "is-type-of": "^1.4.0",
    "js-base64": "^2.5.2",
    "jstoxml": "^2.0.0",
    "lodash": "^4.17.21",
    "merge-descriptors": "^1.0.1",
    "mime": "^2.4.5",
    "platform": "^1.3.1",
    "pump": "^3.0.0",
    "qs": "^6.4.0",
    "sdk-base": "^2.0.1",
    "stream-http": "2.8.2",
    "stream-wormhole": "^1.0.4",
    "urllib": "^2.44.0",
    "utility": "^1.18.0",
    "xml2js": "^0.6.2"
  },
  "snyk": true,
  "lint-staged": {
    "**/!(dist)/*": [
      "npm run detect-secrets --"
    ],
    "**/*.{js,ts}": [
      "eslint --cache --fix --ext .js,.ts",
      "prettier --write",
      "git add"
    ]
  }
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307238, function(require, module, exports) {
const crypto = require('crypto');
const is = require('is-type-of');
const qs = require('qs');
const { lowercaseKeyHeader } = require('./utils/lowercaseKeyHeader');
const { encodeString } = require('./utils/encodeString');

/**
 *
 * @param {String} resourcePath
 * @param {Object} parameters
 * @return
 */
exports.buildCanonicalizedResource = function buildCanonicalizedResource(resourcePath, parameters) {
  let canonicalizedResource = `${resourcePath}`;
  let separatorString = '?';

  if (is.string(parameters) && parameters.trim() !== '') {
    canonicalizedResource += separatorString + parameters;
  } else if (is.array(parameters)) {
    parameters.sort();
    canonicalizedResource += separatorString + parameters.join('&');
  } else if (parameters) {
    const processFunc = key => {
      canonicalizedResource += separatorString + key;
      if (parameters[key] || parameters[key] === 0) {
        canonicalizedResource += `=${parameters[key]}`;
      }
      separatorString = '&';
    };
    Object.keys(parameters).sort().forEach(processFunc);
  }

  return canonicalizedResource;
};

/**
 * @param {String} method
 * @param {String} resourcePath
 * @param {Object} request
 * @param {String} expires
 * @return {String} canonicalString
 */
exports.buildCanonicalString = function canonicalString(method, resourcePath, request, expires) {
  request = request || {};
  const headers = lowercaseKeyHeader(request.headers);
  const OSS_PREFIX = 'x-oss-';
  const ossHeaders = [];
  const headersToSign = {};

  let signContent = [
    method.toUpperCase(),
    headers['content-md5'] || '',
    headers['content-type'],
    expires || headers['x-oss-date']
  ];

  Object.keys(headers).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.indexOf(OSS_PREFIX) === 0) {
      headersToSign[lowerKey] = String(headers[key]).trim();
    }
  });

  Object.keys(headersToSign)
    .sort()
    .forEach(key => {
      ossHeaders.push(`${key}:${headersToSign[key]}`);
    });

  signContent = signContent.concat(ossHeaders);

  signContent.push(this.buildCanonicalizedResource(resourcePath, request.parameters));

  return signContent.join('\n');
};

/**
 * @param {String} accessKeySecret
 * @param {String} canonicalString
 */
exports.computeSignature = function computeSignature(accessKeySecret, canonicalString, headerEncoding = 'utf-8') {
  const signature = crypto.createHmac('sha1', accessKeySecret);
  return signature.update(Buffer.from(canonicalString, headerEncoding)).digest('base64');
};

/**
 * @param {String} accessKeyId
 * @param {String} accessKeySecret
 * @param {String} canonicalString
 */
exports.authorization = function authorization(accessKeyId, accessKeySecret, canonicalString, headerEncoding) {
  return `OSS ${accessKeyId}:${this.computeSignature(accessKeySecret, canonicalString, headerEncoding)}`;
};

/**
 * @param {string[]} [additionalHeaders]
 * @returns {string[]}
 */
exports.fixAdditionalHeaders = additionalHeaders => {
  if (!additionalHeaders) {
    return [];
  }

  const OSS_PREFIX = 'x-oss-';

  return [...new Set(additionalHeaders.map(v => v.toLowerCase()))]
    .filter(v => {
      return v !== 'content-type' && v !== 'content-md5' && !v.startsWith(OSS_PREFIX);
    })
    .sort();
};

/**
 * @param {string} method
 * @param {Object} request
 * @param {Object} request.headers
 * @param {Object} [request.queries]
 * @param {string} [bucketName]
 * @param {string} [objectName]
 * @param {string[]} [additionalHeaders] additional headers after deduplication, lowercase and sorting
 * @returns {string}
 */
exports.getCanonicalRequest = function getCanonicalRequest(method, request, bucketName, objectName, additionalHeaders) {
  const headers = lowercaseKeyHeader(request.headers);
  const queries = request.queries || {};
  const OSS_PREFIX = 'x-oss-';

  if (objectName && !bucketName) {
    throw Error('Please ensure that bucketName is passed into getCanonicalRequest.');
  }

  const signContent = [
    method.toUpperCase(), // HTTP Verb
    encodeString(`/${bucketName ? `${bucketName}/` : ''}${objectName || ''}`).replace(/%2F/g, '/') // Canonical URI
  ];

  // Canonical Query String
  signContent.push(
    qs.stringify(queries, {
      encoder: encodeString,
      sort: (a, b) => a.localeCompare(b),
      strictNullHandling: true
    })
  );

  // Canonical Headers
  if (additionalHeaders) {
    additionalHeaders.forEach(v => {
      if (!Object.prototype.hasOwnProperty.call(headers, v)) {
        throw Error(`Can't find additional header ${v} in request headers.`);
      }
    });
  }

  const tempHeaders = new Set(additionalHeaders);

  Object.keys(headers).forEach(v => {
    if (v === 'content-type' || v === 'content-md5' || v.startsWith(OSS_PREFIX)) {
      tempHeaders.add(v);
    }
  });

  const canonicalHeaders = `${[...tempHeaders]
    .sort()
    .map(v => `${v}:${is.string(headers[v]) ? headers[v].trim() : headers[v]}\n`)
    .join('')}`;

  signContent.push(canonicalHeaders);

  // Additional Headers
  if (additionalHeaders && additionalHeaders.length > 0) {
    signContent.push(additionalHeaders.join(';'));
  } else {
    signContent.push('');
  }

  // Hashed Payload
  signContent.push(headers['x-oss-content-sha256'] || 'UNSIGNED-PAYLOAD');

  return signContent.join('\n');
};

/**
 * @param {string} date yyyymmdd
 * @param {string} region Standard region, e.g. cn-hangzhou
 * @param {string} [accessKeyId] Access Key ID
 * @param {string} [product] Product name, default is oss
 * @returns {string}
 */
exports.getCredential = function getCredential(date, region, accessKeyId, product = 'oss') {
  const tempCredential = `${date}/${region}/${product}/aliyun_v4_request`;

  if (accessKeyId) {
    return `${accessKeyId}/${tempCredential}`;
  }

  return tempCredential;
};

/**
 * @param {string} region Standard region, e.g. cn-hangzhou
 * @param {string} date ISO8601 UTC:yyyymmdd'T'HHMMss'Z'
 * @param {string} canonicalRequest
 * @returns {string}
 */
exports.getStringToSign = function getStringToSign(region, date, canonicalRequest) {
  const stringToSign = [
    'OSS4-HMAC-SHA256',
    date, // TimeStamp
    this.getCredential(date.split('T')[0], region), // Scope
    crypto.createHash('sha256').update(canonicalRequest).digest('hex') // Hashed Canonical Request
  ];

  return stringToSign.join('\n');
};

/**
 * @param {String} accessKeySecret
 * @param {string} date yyyymmdd
 * @param {string} region Standard region, e.g. cn-hangzhou
 * @param {string} stringToSign
 * @returns {string}
 */
exports.getSignatureV4 = function getSignatureV4(accessKeySecret, date, region, stringToSign) {
  const signingDate = crypto.createHmac('sha256', `aliyun_v4${accessKeySecret}`).update(date).digest();
  const signingRegion = crypto.createHmac('sha256', signingDate).update(region).digest();
  const signingOss = crypto.createHmac('sha256', signingRegion).update('oss').digest();
  const signingKey = crypto.createHmac('sha256', signingOss).update('aliyun_v4_request').digest();
  const signatureValue = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return signatureValue;
};

/**
 * @param {String} accessKeyId
 * @param {String} accessKeySecret
 * @param {string} region Standard region, e.g. cn-hangzhou
 * @param {string} method
 * @param {Object} request
 * @param {Object} request.headers
 * @param {Object} [request.queries]
 * @param {string} [bucketName]
 * @param {string} [objectName]
 * @param {string[]} [additionalHeaders]
 * @param {string} [headerEncoding='utf-8']
 * @returns {string}
 */
exports.authorizationV4 = function authorizationV4(
  accessKeyId,
  accessKeySecret,
  region,
  method,
  request,
  bucketName,
  objectName,
  additionalHeaders,
  headerEncoding = 'utf-8'
) {
  const fixedAdditionalHeaders = this.fixAdditionalHeaders(additionalHeaders);
  const fixedHeaders = {};
  Object.entries(request.headers).forEach(v => {
    fixedHeaders[v[0]] = is.string(v[1]) ? Buffer.from(v[1], headerEncoding).toString() : v[1];
  });
  const date = fixedHeaders['x-oss-date'] || (request.queries && request.queries['x-oss-date']);
  const canonicalRequest = this.getCanonicalRequest(
    method,
    {
      headers: fixedHeaders,
      queries: request.queries
    },
    bucketName,
    objectName,
    fixedAdditionalHeaders
  );
  const stringToSign = this.getStringToSign(region, date, canonicalRequest);
  const onlyDate = date.split('T')[0];
  const signatureValue = this.getSignatureV4(accessKeySecret, onlyDate, region, stringToSign);
  const additionalHeadersValue =
    fixedAdditionalHeaders.length > 0 ? `AdditionalHeaders=${fixedAdditionalHeaders.join(';')},` : '';

  return `OSS4-HMAC-SHA256 Credential=${this.getCredential(onlyDate, region, accessKeyId)},${additionalHeadersValue}Signature=${signatureValue}`;
};

/**
 *
 * @param {String} accessKeySecret
 * @param {Object} options
 * @param {String} resource
 * @param {Number} expires
 */
exports._signatureForURL = function _signatureForURL(accessKeySecret, options = {}, resource, expires, headerEncoding) {
  const headers = {};
  const { subResource = {} } = options;

  if (options.process) {
    const processKeyword = 'x-oss-process';
    subResource[processKeyword] = options.process;
  }

  if (options.trafficLimit) {
    const trafficLimitKey = 'x-oss-traffic-limit';
    subResource[trafficLimitKey] = options.trafficLimit;
  }

  if (options.response) {
    Object.keys(options.response).forEach(k => {
      const key = `response-${k.toLowerCase()}`;
      subResource[key] = options.response[k];
    });
  }

  Object.keys(options).forEach(key => {
    const lowerKey = key.toLowerCase();
    const value = options[key];
    if (lowerKey.indexOf('x-oss-') === 0) {
      headers[lowerKey] = value;
    } else if (lowerKey.indexOf('content-md5') === 0) {
      headers[key] = value;
    } else if (lowerKey.indexOf('content-type') === 0) {
      headers[key] = value;
    }
  });

  if (Object.prototype.hasOwnProperty.call(options, 'security-token')) {
    subResource['security-token'] = options['security-token'];
  }

  if (Object.prototype.hasOwnProperty.call(options, 'callback')) {
    const json = {
      callbackUrl: encodeURI(options.callback.url),
      callbackBody: options.callback.body
    };
    if (options.callback.host) {
      json.callbackHost = options.callback.host;
    }
    if (options.callback.contentType) {
      json.callbackBodyType = options.callback.contentType;
    }
    if (options.callback.callbackSNI) {
      json.callbackSNI = options.callback.callbackSNI;
    }
    subResource.callback = Buffer.from(JSON.stringify(json)).toString('base64');

    if (options.callback.customValue) {
      const callbackVar = {};
      Object.keys(options.callback.customValue).forEach(key => {
        callbackVar[`x:${key}`] = options.callback.customValue[key];
      });
      subResource['callback-var'] = Buffer.from(JSON.stringify(callbackVar)).toString('base64');
    }
  }

  const canonicalString = this.buildCanonicalString(
    options.method,
    resource,
    {
      headers,
      parameters: subResource
    },
    expires.toString()
  );

  return {
    Signature: this.computeSignature(accessKeySecret, canonicalString, headerEncoding),
    subResource
  };
};

}, function(modId) { var map = {"./utils/lowercaseKeyHeader":1745133307239,"./utils/encodeString":1745133307241}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307239, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.lowercaseKeyHeader = void 0;
const isObject_1 = require("./isObject");
function lowercaseKeyHeader(headers) {
    const lowercaseHeader = {};
    if (isObject_1.isObject(headers)) {
        Object.keys(headers).forEach(key => {
            lowercaseHeader[key.toLowerCase()] = headers[key];
        });
    }
    return lowercaseHeader;
}
exports.lowercaseKeyHeader = lowercaseKeyHeader;

}, function(modId) { var map = {"./isObject":1745133307240}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307240, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.isObject = void 0;
exports.isObject = obj => {
    return Object.prototype.toString.call(obj) === '[object Object]';
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307241, function(require, module, exports) {

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeString = void 0;
const toString_1 = __importDefault(require("lodash/toString"));
function encodeString(str) {
    const tempStr = toString_1.default(str);
    return encodeURIComponent(tempStr).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
exports.encodeString = encodeString;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307242, function(require, module, exports) {
const ms = require('humanize-ms');
const urlutil = require('url');
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { setRegion } = require('../utils/setRegion');
const { checkConfigValid } = require('../utils/checkConfigValid');

function setEndpoint(endpoint, secure) {
  checkConfigValid(endpoint, 'endpoint');
  let url = urlutil.parse(endpoint);

  if (!url.protocol) {
    url = urlutil.parse(`http${secure ? 's' : ''}://${endpoint}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Endpoint protocol must be http or https.');
  }

  return url;
}

module.exports = function (options) {
  if (!options || !options.accessKeyId || !options.accessKeySecret) {
    throw new Error('require accessKeyId, accessKeySecret');
  }
  if (options.stsToken && !options.refreshSTSToken && !options.refreshSTSTokenInterval) {
    console.warn(
      "It's recommended to set 'refreshSTSToken' and 'refreshSTSTokenInterval' to refresh" +
        ' stsToken、accessKeyId、accessKeySecret automatically when sts token has expired'
    );
  }
  if (options.bucket) {
    _checkBucketName(options.bucket);
  }
  const opts = Object.assign(
    {
      region: 'oss-cn-hangzhou',
      internal: false,
      secure: false,
      timeout: 60000,
      bucket: null,
      endpoint: null,
      cname: false,
      isRequestPay: false,
      sldEnable: false,
      headerEncoding: 'utf-8',
      refreshSTSToken: null,
      refreshSTSTokenInterval: 60000 * 5,
      retryMax: 0,
      authorizationV4: false // 启用v4签名，默认关闭
    },
    options
  );

  opts.accessKeyId = opts.accessKeyId.trim();
  opts.accessKeySecret = opts.accessKeySecret.trim();

  if (opts.timeout) {
    opts.timeout = ms(opts.timeout);
  }

  if (opts.endpoint) {
    opts.endpoint = setEndpoint(opts.endpoint, opts.secure);
  } else if (opts.region) {
    opts.endpoint = setRegion(opts.region, opts.internal, opts.secure);
  } else {
    throw new Error('require options.endpoint or options.region');
  }

  opts.inited = true;
  return opts;
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/setRegion":1745133307244,"../utils/checkConfigValid":1745133307245}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307243, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBucketName = void 0;
exports.checkBucketName = (name, createBucket = false) => {
    const bucketRegex = createBucket ? /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/ : /^[a-z0-9_][a-z0-9-_]{1,61}[a-z0-9_]$/;
    if (!bucketRegex.test(name)) {
        throw new Error('The bucket must be conform to the specifications');
    }
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307244, function(require, module, exports) {

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRegion = void 0;
const url_1 = __importDefault(require("url"));
const checkConfigValid_1 = require("./checkConfigValid");
function setRegion(region, internal = false, secure = false) {
    checkConfigValid_1.checkConfigValid(region, 'region');
    const protocol = secure ? 'https://' : 'http://';
    let suffix = internal ? '-internal.aliyuncs.com' : '.aliyuncs.com';
    const prefix = 'vpc100-oss-cn-';
    // aliyun VPC region: https://help.aliyun.com/knowledge_detail/38740.html
    if (region.substr(0, prefix.length) === prefix) {
        suffix = '.aliyuncs.com';
    }
    return url_1.default.parse(protocol + region + suffix);
}
exports.setRegion = setRegion;

}, function(modId) { var map = {"./checkConfigValid":1745133307245}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307245, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.checkConfigValid = void 0;
const checkConfigMap = {
    endpoint: checkEndpoint,
    region: /^[a-zA-Z0-9\-_]+$/
};
function checkEndpoint(endpoint) {
    if (typeof endpoint === 'string') {
        return /^[a-zA-Z0-9._:/-]+$/.test(endpoint);
    }
    else if (endpoint.host) {
        return /^[a-zA-Z0-9._:/-]+$/.test(endpoint.host);
    }
    return false;
}
exports.checkConfigValid = (conf, key) => {
    if (checkConfigMap[key]) {
        let isConfigValid = true;
        if (checkConfigMap[key] instanceof Function) {
            isConfigValid = checkConfigMap[key](conf);
        }
        else {
            isConfigValid = checkConfigMap[key].test(conf);
        }
        if (!isConfigValid) {
            throw new Error(`The ${key} must be conform to the specifications`);
        }
    }
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307246, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequest = void 0;
const crypto = require('crypto');
const debug = require('debug')('ali-oss');
const _isString = require('lodash/isString');
const _isArray = require('lodash/isArray');
const _isObject = require('lodash/isObject');
const mime = require('mime');
const dateFormat = require('dateformat');
const copy = require('copy-to');
const path = require('path');
const { encoder } = require('./encoder');
const { isIP } = require('./isIP');
const { setRegion } = require('./setRegion');
const { getReqUrl } = require('../client/getReqUrl');
const { isDingTalk } = require('./isDingTalk');
function getHeader(headers, name) {
    return headers[name] || headers[name.toLowerCase()];
}
function delHeader(headers, name) {
    delete headers[name];
    delete headers[name.toLowerCase()];
}
function createRequest(params) {
    let date = new Date();
    if (this.options.amendTimeSkewed) {
        date = +new Date() + this.options.amendTimeSkewed;
    }
    const headers = {
        'x-oss-date': dateFormat(date, this.options.authorizationV4 ? "UTC:yyyymmdd'T'HHMMss'Z'" : "UTC:ddd, dd mmm yyyy HH:MM:ss 'GMT'")
    };
    if (this.options.authorizationV4) {
        headers['x-oss-content-sha256'] = 'UNSIGNED-PAYLOAD';
    }
    if (typeof window !== 'undefined') {
        headers['x-oss-user-agent'] = this.userAgent;
    }
    if (this.userAgent.includes('nodejs')) {
        headers['User-Agent'] = this.userAgent;
    }
    if (this.options.isRequestPay) {
        Object.assign(headers, { 'x-oss-request-payer': 'requester' });
    }
    if (this.options.stsToken) {
        headers['x-oss-security-token'] = this.options.stsToken;
    }
    copy(params.headers).to(headers);
    if (!getHeader(headers, 'Content-Type')) {
        if (params.mime && params.mime.indexOf('/') > 0) {
            headers['Content-Type'] = params.mime;
        }
        else if (isDingTalk()) {
            headers['Content-Type'] = 'application/octet-stream';
        }
        else {
            headers['Content-Type'] = mime.getType(params.mime || path.extname(params.object || ''));
        }
    }
    if (!getHeader(headers, 'Content-Type')) {
        delHeader(headers, 'Content-Type');
    }
    if (params.content) {
        if (!params.disabledMD5) {
            if (!params.headers || !params.headers['Content-MD5']) {
                headers['Content-MD5'] = crypto.createHash('md5').update(Buffer.from(params.content, 'utf8')).digest('base64');
            }
            else {
                headers['Content-MD5'] = params.headers['Content-MD5'];
            }
        }
        if (!headers['Content-Length']) {
            headers['Content-Length'] = params.content.length;
        }
    }
    const { hasOwnProperty } = Object.prototype;
    for (const k in headers) {
        if (headers[k] && hasOwnProperty.call(headers, k)) {
            headers[k] = encoder(String(headers[k]), this.options.headerEncoding);
        }
    }
    const queries = {};
    if (_isString(params.subres)) {
        queries[params.subres] = null;
    }
    else if (_isArray(params.subres)) {
        params.subres.forEach(v => {
            queries[v] = null;
        });
    }
    else if (_isObject(params.subres)) {
        Object.entries(params.subres).forEach(v => {
            queries[v[0]] = v[1] === '' ? null : v[1];
        });
    }
    if (_isObject(params.query)) {
        Object.entries(params.query).forEach(v => {
            queries[v[0]] = v[1];
        });
    }
    headers.authorization = this.options.authorizationV4
        ? this.authorizationV4(params.method, {
            headers,
            queries
        }, params.bucket, params.object, params.additionalHeaders)
        : this.authorization(params.method, this._getResource(params), params.subres, headers, this.options.headerEncoding);
    // const url = this._getReqUrl(params);
    if (isIP(this.options.endpoint.hostname)) {
        const { region, internal, secure } = this.options;
        const hostInfo = setRegion(region, internal, secure);
        headers.host = `${params.bucket}.${hostInfo.host}`;
    }
    const url = getReqUrl.bind(this)(params);
    debug('request %s %s, with headers %j, !!stream: %s', params.method, url, headers, !!params.stream);
    const timeout = params.timeout || this.options.timeout;
    const reqParams = {
        method: params.method,
        content: params.content,
        stream: params.stream,
        headers,
        timeout,
        writeStream: params.writeStream,
        customResponse: params.customResponse,
        ctx: params.ctx || this.ctx
    };
    if (this.agent) {
        reqParams.agent = this.agent;
    }
    if (this.httpsAgent) {
        reqParams.httpsAgent = this.httpsAgent;
    }
    reqParams.enableProxy = !!this.options.enableProxy;
    reqParams.proxy = this.options.proxy ? this.options.proxy : null;
    return {
        url,
        params: reqParams
    };
}
exports.createRequest = createRequest;

}, function(modId) { var map = {"./encoder":1745133307247,"./isIP":1745133307248,"./setRegion":1745133307244,"../client/getReqUrl":1745133307249,"./isDingTalk":1745133307250}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307247, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.encoder = void 0;
function encoder(str, encoding = 'utf-8') {
    if (encoding === 'utf-8')
        return str;
    return Buffer.from(str).toString('latin1');
}
exports.encoder = encoder;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307248, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.isIP = void 0;
// it provide commont methods for node and browser , we will add more solutions later in this file
/**
 * Judge isIP include ipv4 or ipv6
 * @param {String} options
 * @return {Array} the multipart uploads
 */
exports.isIP = host => {
    const ipv4Regex = /^(25[0-5]|2[0-4]\d|[0-1]?\d?\d)(\.(25[0-5]|2[0-4]\d|[0-1]?\d?\d)){3}$/;
    const ipv6Regex = /^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/;
    return ipv4Regex.test(host) || ipv6Regex.test(host);
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307249, function(require, module, exports) {

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReqUrl = void 0;
const copy_to_1 = __importDefault(require("copy-to"));
const url_1 = __importDefault(require("url"));
const merge_descriptors_1 = __importDefault(require("merge-descriptors"));
const is_type_of_1 = __importDefault(require("is-type-of"));
const isIP_1 = require("../utils/isIP");
const checkConfigValid_1 = require("../utils/checkConfigValid");
function getReqUrl(params) {
    const ep = {};
    const isCname = this.options.cname;
    checkConfigValid_1.checkConfigValid(this.options.endpoint, 'endpoint');
    copy_to_1.default(this.options.endpoint, false).to(ep);
    if (params.bucket && !isCname && !isIP_1.isIP(ep.hostname) && !this.options.sldEnable) {
        ep.host = `${params.bucket}.${ep.host}`;
    }
    let resourcePath = '/';
    if (params.bucket && this.options.sldEnable) {
        resourcePath += `${params.bucket}/`;
    }
    if (params.object) {
        // Preserve '/' in result url
        resourcePath += this._escape(params.object).replace(/\+/g, '%2B');
    }
    ep.pathname = resourcePath;
    const query = {};
    if (params.query) {
        merge_descriptors_1.default(query, params.query);
    }
    if (params.subres) {
        let subresAsQuery = {};
        if (is_type_of_1.default.string(params.subres)) {
            subresAsQuery[params.subres] = '';
        }
        else if (is_type_of_1.default.array(params.subres)) {
            params.subres.forEach(k => {
                subresAsQuery[k] = '';
            });
        }
        else {
            subresAsQuery = params.subres;
        }
        merge_descriptors_1.default(query, subresAsQuery);
    }
    ep.query = query;
    return url_1.default.format(ep);
}
exports.getReqUrl = getReqUrl;

}, function(modId) { var map = {"../utils/isIP":1745133307248,"../utils/checkConfigValid":1745133307245}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307250, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.isDingTalk = void 0;
function isDingTalk() {
    if (process.browser && window.navigator.userAgent.toLowerCase().includes('aliapp(dingtalk')) {
        return true;
    }
    return false;
}
exports.isDingTalk = isDingTalk;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307251, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCredentials = exports.setSTSToken = void 0;
const formatObjKey_1 = require("./formatObjKey");
async function setSTSToken() {
    if (!this.options)
        this.options = {};
    const now = new Date();
    if (this.stsTokenFreshTime) {
        if (+now - this.stsTokenFreshTime >= this.options.refreshSTSTokenInterval) {
            this.stsTokenFreshTime = now;
            let credentials = await this.options.refreshSTSToken();
            credentials = formatObjKey_1.formatObjKey(credentials, 'firstLowerCase');
            if (credentials.securityToken) {
                credentials.stsToken = credentials.securityToken;
            }
            checkCredentials(credentials);
            Object.assign(this.options, credentials);
        }
    }
    else {
        this.stsTokenFreshTime = now;
    }
    return null;
}
exports.setSTSToken = setSTSToken;
function checkCredentials(obj) {
    const stsTokenKey = ['accessKeySecret', 'accessKeyId', 'stsToken'];
    const objKeys = Object.keys(obj);
    stsTokenKey.forEach(_ => {
        if (!objKeys.find(key => key === _)) {
            throw Error(`refreshSTSToken must return contains ${_}`);
        }
    });
}
exports.checkCredentials = checkCredentials;

}, function(modId) { var map = {"./formatObjKey":1745133307252}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307252, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.formatObjKey = void 0;
function formatObjKey(obj, type, options) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    let o;
    if (Array.isArray(obj)) {
        o = [];
        for (let i = 0; i < obj.length; i++) {
            o.push(formatObjKey(obj[i], type, options));
        }
    }
    else {
        o = {};
        Object.keys(obj).forEach(key => {
            o[handelFormat(key, type, options)] = formatObjKey(obj[key], type, options);
        });
    }
    return o;
}
exports.formatObjKey = formatObjKey;
function handelFormat(key, type, options) {
    if (options && options.exclude && options.exclude.includes(key))
        return key;
    if (type === 'firstUpperCase') {
        key = key.replace(/^./, (_) => _.toUpperCase());
    }
    else if (type === 'firstLowerCase') {
        key = key.replace(/^./, (_) => _.toLowerCase());
    }
    return key;
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307253, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = void 0;
function retry(func, retryMax, config = {}) {
    let retryNum = 0;
    const { retryDelay = 500, errorHandler = () => true } = config;
    const funcR = (...arg) => {
        return new Promise((resolve, reject) => {
            func(...arg)
                .then(result => {
                retryNum = 0;
                resolve(result);
            })
                .catch(err => {
                if (retryNum < retryMax && errorHandler(err)) {
                    retryNum++;
                    setTimeout(() => {
                        resolve(funcR(...arg));
                    }, retryDelay);
                }
                else {
                    retryNum = 0;
                    reject(err);
                }
            });
        });
    };
    return funcR;
}
exports.retry = retry;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307254, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.isFunction = void 0;
exports.isFunction = (v) => {
    return typeof v === 'function';
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307255, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.getStandardRegion = void 0;
function getStandardRegion(str) {
    return str.replace(/^oss-/g, '');
}
exports.getStandardRegion = getStandardRegion;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307256, function(require, module, exports) {
const merge = require('merge-descriptors');

const proto = exports;

merge(proto, require('./getSymlink'));
merge(proto, require('./putSymlink'));
merge(proto, require('./getObjectMeta'));
merge(proto, require('./copyObject'));
merge(proto, require('./calculatePostSignature'));
merge(proto, require('./getObjectTagging'));
merge(proto, require('./putObjectTagging'));
merge(proto, require('./deleteObjectTagging'));
merge(proto, require('./getBucketVersions'));
merge(proto, require('./deleteMulti'));
merge(proto, require('./getACL'));
merge(proto, require('./putACL'));
merge(proto, require('./head'));
merge(proto, require('./delete'));
merge(proto, require('./get'));
merge(proto, require('./postAsyncFetch'));
merge(proto, require('./getAsyncFetch'));
merge(proto, require('./generateObjectUrl'));
merge(proto, require('./getObjectUrl'));
merge(proto, require('./signatureUrl'));
merge(proto, require('./asyncSignatureUrl'));
merge(proto, require('./signatureUrlV4'));
merge(proto, require('./signPostObjectPolicyV4'));

}, function(modId) { var map = {"./getSymlink":1745133307257,"./putSymlink":1745133307258,"./getObjectMeta":1745133307259,"./copyObject":1745133307260,"./calculatePostSignature":1745133307261,"./getObjectTagging":1745133307263,"./putObjectTagging":1745133307264,"./deleteObjectTagging":1745133307268,"./getBucketVersions":1745133307269,"./deleteMulti":1745133307272,"./getACL":1745133307273,"./putACL":1745133307274,"./head":1745133307275,"./delete":1745133307277,"./get":1745133307278,"./postAsyncFetch":1745133307279,"./getAsyncFetch":1745133307280,"./generateObjectUrl":1745133307281,"./getObjectUrl":1745133307282,"./signatureUrl":1745133307283,"./asyncSignatureUrl":1745133307284,"./signatureUrlV4":1745133307285,"./signPostObjectPolicyV4":1745133307286}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307257, function(require, module, exports) {
const proto = exports;
/**
 * getSymlink
 * @param {String} name - object name
 * @param {Object} options
 * @param {{res}}
 */

proto.getSymlink = async function getSymlink(name, options = {}) {
  options.subres = Object.assign({ symlink: '' }, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  name = this._objectName(name);
  const params = this._objectRequestParams('GET', name, options);
  params.successStatuses = [200];
  const result = await this.request(params);
  const target = result.res.headers['x-oss-symlink-target'];
  return {
    targetName: decodeURIComponent(target),
    res: result.res
  };
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307258, function(require, module, exports) {
const proto = exports;
/**
 * putSymlink
 * @param {String} name - object name
 * @param {String} targetName - target name
 * @param {Object} options
 * @param {{res}}
 */

proto.putSymlink = async function putSymlink(name, targetName, options) {
  options = options || {};
  options.headers = options.headers || {};
  targetName = this._escape(this._objectName(targetName));
  this._convertMetaToHeaders(options.meta, options.headers);
  options.headers['x-oss-symlink-target'] = targetName;
  options.subres = Object.assign({ symlink: '' }, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }

  if (options.storageClass) {
    options.headers['x-oss-storage-class'] = options.storageClass;
  }

  name = this._objectName(name);
  const params = this._objectRequestParams('PUT', name, options);

  params.successStatuses = [200];
  const result = await this.request(params);
  return {
    res: result.res
  };
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307259, function(require, module, exports) {
const proto = exports;
/**
 * getObjectMeta
 * @param {String} name - object name
 * @param {Object} options
 * @param {{res}}
 */

proto.getObjectMeta = async function getObjectMeta(name, options) {
  options = options || {};
  name = this._objectName(name);
  options.subres = Object.assign({ objectMeta: '' }, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  const params = this._objectRequestParams('HEAD', name, options);
  params.successStatuses = [200];
  const result = await this.request(params);
  return {
    status: result.status,
    res: result.res
  };
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307260, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');

const proto = exports;

const REPLACE_HEDERS = [
  'content-type',
  'content-encoding',
  'content-language',
  'content-disposition',
  'cache-control',
  'expires'
];

proto.copy = async function copy(name, sourceName, bucketName, options) {
  if (typeof bucketName === 'object') {
    options = bucketName; // 兼容旧版本，旧版本第三个参数为options
  }
  options = options || {};
  options.headers = options.headers || {};

  Object.keys(options.headers).forEach(key => {
    options.headers[`x-oss-copy-source-${key.toLowerCase()}`] = options.headers[key];
  });
  if (options.meta || Object.keys(options.headers).find(_ => REPLACE_HEDERS.includes(_.toLowerCase()))) {
    options.headers['x-oss-metadata-directive'] = 'REPLACE';
  }
  this._convertMetaToHeaders(options.meta, options.headers);

  sourceName = this._getSourceName(sourceName, bucketName);

  if (options.versionId) {
    sourceName = `${sourceName}?versionId=${options.versionId}`;
  }

  options.headers['x-oss-copy-source'] = sourceName;

  const params = this._objectRequestParams('PUT', name, options);
  params.xmlResponse = true;
  params.successStatuses = [200, 304];

  const result = await this.request(params);

  let { data } = result;
  if (data) {
    data = {
      etag: data.ETag,
      lastModified: data.LastModified
    };
  }

  return {
    data,
    res: result.res
  };
};

// todo delete
proto._getSourceName = function _getSourceName(sourceName, bucketName) {
  if (typeof bucketName === 'string') {
    sourceName = this._objectName(sourceName);
  } else if (sourceName[0] !== '/') {
    bucketName = this.options.bucket;
  } else {
    bucketName = sourceName.replace(/\/(.+?)(\/.*)/, '$1');
    sourceName = sourceName.replace(/(\/.+?\/)(.*)/, '$2');
  }

  _checkBucketName(bucketName);

  sourceName = encodeURIComponent(sourceName);

  sourceName = `/${bucketName}/${sourceName}`;
  return sourceName;
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307261, function(require, module, exports) {
const { policy2Str } = require('../utils/policy2Str');
const signHelper = require('../signUtils');
const { isObject } = require('../utils/isObject');

const proto = exports;

/**
 * @param {Object or JSON} policy specifies the validity of the fields in the request.
 * @return {Object} params
 *         {String} params.OSSAccessKeyId
 *         {String} params.Signature
 *         {String} params.policy JSON text encoded with UTF-8 and Base64.
 */
proto.calculatePostSignature = function calculatePostSignature(policy) {
  if (!isObject(policy) && typeof policy !== 'string') {
    throw new Error('policy must be JSON string or Object');
  }
  if (!isObject(policy)) {
    try {
      JSON.stringify(JSON.parse(policy));
    } catch (error) {
      throw new Error('policy must be JSON string or Object');
    }
  }
  policy = Buffer.from(policy2Str(policy), 'utf8').toString('base64');

  const Signature = signHelper.computeSignature(this.options.accessKeySecret, policy);

  const query = {
    OSSAccessKeyId: this.options.accessKeyId,
    Signature,
    policy
  };
  return query;
};

}, function(modId) { var map = {"../utils/policy2Str":1745133307262,"../signUtils":1745133307238,"../utils/isObject":1745133307240}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307262, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.policy2Str = void 0;
function policy2Str(policy) {
    let policyStr;
    if (policy) {
        if (typeof policy === 'string') {
            try {
                policyStr = JSON.stringify(JSON.parse(policy));
            }
            catch (err) {
                throw new Error(`Policy string is not a valid JSON: ${err.message}`);
            }
        }
        else {
            policyStr = JSON.stringify(policy);
        }
    }
    return policyStr;
}
exports.policy2Str = policy2Str;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307263, function(require, module, exports) {
const proto = exports;
const { isObject } = require('../utils/isObject');
/**
 * getObjectTagging
 * @param {String} name - object name
 * @param {Object} options
 * @return {Object}
 */

proto.getObjectTagging = async function getObjectTagging(name, options = {}) {
  options.subres = Object.assign({ tagging: '' }, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  name = this._objectName(name);
  const params = this._objectRequestParams('GET', name, options);
  params.successStatuses = [200];
  const result = await this.request(params);
  const Tagging = await this.parseXML(result.data);
  let { Tag } = Tagging.TagSet;
  Tag = Tag && isObject(Tag) ? [Tag] : Tag || [];

  const tag = {};

  Tag.forEach(item => {
    tag[item.Key] = item.Value;
  });

  return {
    status: result.status,
    res: result.res,
    tag
  };
};

}, function(modId) { var map = {"../utils/isObject":1745133307240}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307264, function(require, module, exports) {
const { obj2xml } = require('../utils/obj2xml');
const { checkObjectTag } = require('../utils/checkObjectTag');

const proto = exports;
/**
 * putObjectTagging
 * @param {String} name - object name
 * @param {Object} tag -  object tag, eg: `{a: "1", b: "2"}`
 * @param {Object} options
 */

proto.putObjectTagging = async function putObjectTagging(name, tag, options = {}) {
  checkObjectTag(tag);

  options.subres = Object.assign({ tagging: '' }, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  name = this._objectName(name);
  const params = this._objectRequestParams('PUT', name, options);
  params.successStatuses = [200];
  tag = Object.keys(tag).map(key => ({
    Key: key,
    Value: tag[key]
  }));

  const paramXMLObj = {
    Tagging: {
      TagSet: {
        Tag: tag
      }
    }
  };

  params.mime = 'xml';
  params.content = obj2xml(paramXMLObj);

  const result = await this.request(params);
  return {
    res: result.res,
    status: result.status
  };
};

}, function(modId) { var map = {"../utils/obj2xml":1745133307265,"../utils/checkObjectTag":1745133307266}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307265, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.obj2xml = void 0;
const formatObjKey_1 = require("./formatObjKey");
function type(params) {
    return Object.prototype.toString
        .call(params)
        .replace(/(.*? |])/g, '')
        .toLowerCase();
}
function obj2xml(obj, options) {
    let s = '';
    if (options && options.headers) {
        s = '<?xml version="1.0" encoding="UTF-8"?>\n';
    }
    if (options && options.firstUpperCase) {
        obj = formatObjKey_1.formatObjKey(obj, 'firstUpperCase');
    }
    if (type(obj) === 'object') {
        Object.keys(obj).forEach(key => {
            // filter undefined or null
            if (type(obj[key]) !== 'undefined' && type(obj[key]) !== 'null') {
                if (type(obj[key]) === 'string' || type(obj[key]) === 'number') {
                    s += `<${key}>${obj[key]}</${key}>`;
                }
                else if (type(obj[key]) === 'object') {
                    s += `<${key}>${obj2xml(obj[key])}</${key}>`;
                }
                else if (type(obj[key]) === 'array') {
                    s += obj[key].map(keyChild => `<${key}>${obj2xml(keyChild)}</${key}>`).join('');
                }
                else {
                    s += `<${key}>${obj[key].toString()}</${key}>`;
                }
            }
        });
    }
    else {
        s += obj.toString();
    }
    return s;
}
exports.obj2xml = obj2xml;

}, function(modId) { var map = {"./formatObjKey":1745133307252}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307266, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.checkObjectTag = void 0;
const { checkValid } = require('./checkValid');
const { isObject } = require('./isObject');
const commonRules = [
    {
        validator: value => {
            if (typeof value !== 'string') {
                throw new Error('the key and value of the tag must be String');
            }
        }
    },
    {
        pattern: /^[a-zA-Z0-9 +-=._:/]+$/,
        msg: 'tag can contain letters, numbers, spaces, and the following symbols: plus sign (+), hyphen (-), equal sign (=), period (.), underscore (_), colon (:), and forward slash (/)'
    }
];
const rules = {
    key: [
        ...commonRules,
        {
            pattern: /^.{1,128}$/,
            msg: 'tag key can be a maximum of 128 bytes in length'
        }
    ],
    value: [
        ...commonRules,
        {
            pattern: /^.{0,256}$/,
            msg: 'tag value can be a maximum of 256 bytes in length'
        }
    ]
};
function checkObjectTag(tag) {
    if (!isObject(tag)) {
        throw new Error('tag must be Object');
    }
    const entries = Object.entries(tag);
    if (entries.length > 10) {
        throw new Error('maximum of 10 tags for a object');
    }
    const rulesIndexKey = ['key', 'value'];
    entries.forEach(keyValue => {
        keyValue.forEach((item, index) => {
            checkValid(item, rules[rulesIndexKey[index]]);
        });
    });
}
exports.checkObjectTag = checkObjectTag;

}, function(modId) { var map = {"./checkValid":1745133307267,"./isObject":1745133307240}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307267, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.checkValid = void 0;
function checkValid(_value, _rules) {
    _rules.forEach(rule => {
        if (rule.validator) {
            rule.validator(_value);
        }
        else if (rule.pattern && !rule.pattern.test(_value)) {
            throw new Error(rule.msg);
        }
    });
}
exports.checkValid = checkValid;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307268, function(require, module, exports) {
const proto = exports;
/**
 * deleteObjectTagging
 * @param {String} name - object name
 * @param {Object} options
 */

proto.deleteObjectTagging = async function deleteObjectTagging(name, options = {}) {
  options.subres = Object.assign({ tagging: '' }, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  name = this._objectName(name);
  const params = this._objectRequestParams('DELETE', name, options);
  params.successStatuses = [204];
  const result = await this.request(params);

  return {
    status: result.status,
    res: result.res
  };
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307269, function(require, module, exports) {
/* eslint-disable no-use-before-define */
const proto = exports;
const { isObject } = require('../utils/isObject');
const { isArray } = require('../utils/isArray');
const { parseRestoreInfo } = require('../utils/parseRestoreInfo');

proto.getBucketVersions = getBucketVersions;
proto.listObjectVersions = getBucketVersions;

async function getBucketVersions(query = {}, options = {}) {
  // prefix, key-marker, max-keys, delimiter, encoding-type, version-id-marker
  if (query.versionIdMarker && query.keyMarker === undefined) {
    throw new Error('A version-id marker cannot be specified without a key marker');
  }

  options.subres = Object.assign({ versions: '' }, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  const params = this._objectRequestParams('GET', '', options);
  params.xmlResponse = true;
  params.successStatuses = [200];

  params.query = formatQuery(query);

  const result = await this.request(params);
  let objects = result.data.Version || [];
  let deleteMarker = result.data.DeleteMarker || [];
  const that = this;
  if (objects) {
    if (!Array.isArray(objects)) {
      objects = [objects];
    }
    objects = objects.map(obj => ({
      name: obj.Key,
      url: that._objectUrl(obj.Key),
      lastModified: obj.LastModified,
      isLatest: obj.IsLatest === 'true',
      versionId: obj.VersionId,
      etag: obj.ETag,
      type: obj.Type,
      size: Number(obj.Size),
      storageClass: obj.StorageClass,
      owner: {
        id: obj.Owner.ID,
        displayName: obj.Owner.DisplayName
      },
      restoreInfo: parseRestoreInfo(obj.RestoreInfo)
    }));
  }
  if (deleteMarker) {
    if (!isArray(deleteMarker)) {
      deleteMarker = [deleteMarker];
    }
    deleteMarker = deleteMarker.map(obj => ({
      name: obj.Key,
      lastModified: obj.LastModified,
      versionId: obj.VersionId,
      owner: {
        id: obj.Owner.ID,
        displayName: obj.Owner.DisplayName
      }
    }));
  }
  let prefixes = result.data.CommonPrefixes || null;
  if (prefixes) {
    if (!isArray(prefixes)) {
      prefixes = [prefixes];
    }
    prefixes = prefixes.map(item => item.Prefix);
  }
  return {
    res: result.res,
    objects,
    deleteMarker,
    prefixes,
    // attirbute of legacy error
    nextMarker: result.data.NextKeyMarker || null,
    // attirbute of legacy error
    NextVersionIdMarker: result.data.NextVersionIdMarker || null,
    nextKeyMarker: result.data.NextKeyMarker || null,
    nextVersionIdMarker: result.data.NextVersionIdMarker || null,
    isTruncated: result.data.IsTruncated === 'true'
  };
}

function camel2Line(name) {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function formatQuery(query = {}) {
  const obj = {};
  if (isObject(query)) {
    Object.keys(query).forEach(key => {
      obj[camel2Line(key)] = query[key];
    });
  }

  return obj;
}

}, function(modId) { var map = {"../utils/isObject":1745133307240,"../utils/isArray":1745133307270,"../utils/parseRestoreInfo":1745133307271}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307270, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.isArray = void 0;
exports.isArray = obj => {
    return Object.prototype.toString.call(obj) === '[object Array]';
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307271, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRestoreInfo = void 0;
exports.parseRestoreInfo = (originalRestoreInfo) => {
    let tempRestoreInfo;
    if (originalRestoreInfo) {
        tempRestoreInfo = {
            ongoingRequest: originalRestoreInfo.includes('true')
        };
        if (!tempRestoreInfo.ongoingRequest) {
            const matchArray = originalRestoreInfo.match(/expiry-date="(.*)"/);
            if (matchArray && matchArray[1]) {
                tempRestoreInfo.expiryDate = new Date(matchArray[1]);
            }
        }
    }
    return tempRestoreInfo;
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307272, function(require, module, exports) {
/* eslint-disable object-curly-newline */
const utility = require('utility');
const { obj2xml } = require('../utils/obj2xml');

const proto = exports;

proto.deleteMulti = async function deleteMulti(names, options = {}) {
  const objects = [];
  if (!names || !names.length) {
    throw new Error('names is required');
  }
  for (let i = 0; i < names.length; i++) {
    const object = {};
    if (typeof names[i] === 'string') {
      object.Key = utility.escape(this._objectName(names[i]));
    } else {
      const { key, versionId } = names[i];
      object.Key = utility.escape(this._objectName(key));
      object.VersionId = versionId;
    }
    objects.push(object);
  }

  const paramXMLObj = {
    Delete: {
      Quiet: !!options.quiet,
      Object: objects
    }
  };

  const paramXML = obj2xml(paramXMLObj, {
    headers: true
  });

  options.subres = Object.assign({ delete: '' }, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  const params = this._objectRequestParams('POST', '', options);
  params.mime = 'xml';
  params.content = paramXML;
  params.xmlResponse = true;
  params.successStatuses = [200];
  const result = await this.request(params);

  const r = result.data;
  let deleted = (r && r.Deleted) || null;
  if (deleted) {
    if (!Array.isArray(deleted)) {
      deleted = [deleted];
    }
  }
  return {
    res: result.res,
    deleted: deleted || []
  };
};

}, function(modId) { var map = {"../utils/obj2xml":1745133307265}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307273, function(require, module, exports) {
const proto = exports;

/*
 * Get object's ACL
 * @param {String} name the object key
 * @param {Object} options
 * @return {Object}
 */
proto.getACL = async function getACL(name, options = {}) {
  options.subres = Object.assign({ acl: '' }, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  name = this._objectName(name);

  const params = this._objectRequestParams('GET', name, options);
  params.successStatuses = [200];
  params.xmlResponse = true;

  const result = await this.request(params);

  return {
    acl: result.data.AccessControlList.Grant,
    owner: {
      id: result.data.Owner.ID,
      displayName: result.data.Owner.DisplayName
    },
    res: result.res
  };
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307274, function(require, module, exports) {
const proto = exports;

/*
 * Set object's ACL
 * @param {String} name the object key
 * @param {String} acl the object ACL
 * @param {Object} options
 */
proto.putACL = async function putACL(name, acl, options) {
  options = options || {};
  options.subres = Object.assign({ acl: '' }, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  options.headers = options.headers || {};
  options.headers['x-oss-object-acl'] = acl;
  name = this._objectName(name);

  const params = this._objectRequestParams('PUT', name, options);
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    res: result.res
  };
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307275, function(require, module, exports) {
const { checkEnv } = require('../utils/checkEnv');

const proto = exports;
/**
 * head
 * @param {String} name - object name
 * @param {Object} options
 * @param {{res}}
 */

proto.head = async function head(name, options = {}) {
  checkEnv(
    'Because HeadObject has gzip enabled, head cannot get the file size correctly. If you need to get the file size, please use getObjectMeta'
  );
  options.subres = Object.assign({}, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  const params = this._objectRequestParams('HEAD', name, options);
  params.successStatuses = [200, 304];

  const result = await this.request(params);

  const data = {
    meta: null,
    res: result.res,
    status: result.status
  };

  if (result.status === 200) {
    Object.keys(result.headers).forEach(k => {
      if (k.indexOf('x-oss-meta-') === 0) {
        if (!data.meta) {
          data.meta = {};
        }
        data.meta[k.substring(11)] = result.headers[k];
      }
    });
  }
  return data;
};

}, function(modId) { var map = {"../utils/checkEnv":1745133307276}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307276, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.checkEnv = void 0;
function checkEnv(msg) {
    if (process.browser) {
        console.warn(msg);
    }
}
exports.checkEnv = checkEnv;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307277, function(require, module, exports) {
const proto = exports;
/**
 * delete
 * @param {String} name - object name
 * @param {Object} options
 * @param {{res}}
 */

proto.delete = async function _delete(name, options = {}) {
  options.subres = Object.assign({}, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  const params = this._objectRequestParams('DELETE', name, options);
  params.successStatuses = [204];

  const result = await this.request(params);

  return {
    res: result.res
  };
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307278, function(require, module, exports) {
const fs = require('fs');
const is = require('is-type-of');
const { isObject } = require('../utils/isObject');

const proto = exports;
/**
 * get
 * @param {String} name - object name
 * @param {String | Stream | Object} file - file path or file stream or options
 * @param {Object} options
 * @param {{res}}
 */
proto.get = async function get(name, file, options = {}) {
  let writeStream = null;
  let needDestroy = false;

  if (is.writableStream(file)) {
    writeStream = file;
  } else if (is.string(file)) {
    writeStream = fs.createWriteStream(file);
    needDestroy = true;
  } else if (isObject(file)) {
    // get(name, options)
    options = file;
  }

  options = options || {};
  const isBrowserEnv = process && process.browser;
  const responseCacheControl = options.responseCacheControl === null ? '' : 'no-cache';
  const defaultSubresOptions =
    isBrowserEnv && responseCacheControl ? { 'response-cache-control': responseCacheControl } : {};
  options.subres = Object.assign(defaultSubresOptions, options.subres);

  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  if (options.process) {
    options.subres['x-oss-process'] = options.process;
  }

  let result;
  try {
    const params = this._objectRequestParams('GET', name, options);
    params.writeStream = writeStream;
    params.successStatuses = [200, 206, 304];

    result = await this.request(params);

    if (needDestroy) {
      writeStream.destroy();
    }
  } catch (err) {
    if (needDestroy) {
      writeStream.destroy();
      // should delete the exists file before throw error
      await this._deleteFileSafe(file);
    }
    throw err;
  }

  return {
    res: result.res,
    content: result.data
  };
};

}, function(modId) { var map = {"../utils/isObject":1745133307240}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307279, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.postAsyncFetch = void 0;
const obj2xml_1 = require("../utils/obj2xml");
/*
 * postAsyncFetch
 * @param {String} name the object key
 * @param {String} url
 * @param {Object} options
 *        {String} options.host
 *        {String} options.contentMD5
 *        {String} options.callback
 *        {String} options.storageClass Standard/IA/Archive
 *        {Boolean} options.ignoreSameKey  default value true
 */
async function postAsyncFetch(object, url, options = {}) {
    options.subres = Object.assign({ asyncFetch: '' }, options.subres);
    options.headers = options.headers || {};
    object = this._objectName(object);
    const { host = '', contentMD5 = '', callback = '', storageClass = '', ignoreSameKey = true } = options;
    const paramXMLObj = {
        AsyncFetchTaskConfiguration: {
            Url: url,
            Object: object,
            Host: host,
            ContentMD5: contentMD5,
            Callback: callback,
            StorageClass: storageClass,
            IgnoreSameKey: ignoreSameKey
        }
    };
    const params = this._objectRequestParams('POST', '', options);
    params.mime = 'xml';
    params.xmlResponse = true;
    params.successStatuses = [200];
    params.content = obj2xml_1.obj2xml(paramXMLObj);
    const result = await this.request(params);
    return {
        res: result.res,
        status: result.status,
        taskId: result.data.TaskId
    };
}
exports.postAsyncFetch = postAsyncFetch;

}, function(modId) { var map = {"../utils/obj2xml":1745133307265}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307280, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.getAsyncFetch = void 0;
const formatObjKey_1 = require("../utils/formatObjKey");
/*
 * getAsyncFetch
 * @param {String} asyncFetch taskId
 * @param {Object} options
 */
async function getAsyncFetch(taskId, options = {}) {
    options.subres = Object.assign({ asyncFetch: '' }, options.subres);
    options.headers = options.headers || {};
    const params = this._objectRequestParams('GET', '', options);
    params.headers['x-oss-task-id'] = taskId;
    params.successStatuses = [200];
    params.xmlResponse = true;
    const result = await this.request(params);
    const taskInfo = formatObjKey_1.formatObjKey(result.data.TaskInfo, 'firstLowerCase');
    return {
        res: result.res,
        status: result.status,
        state: result.data.State,
        taskInfo
    };
}
exports.getAsyncFetch = getAsyncFetch;

}, function(modId) { var map = {"../utils/formatObjKey":1745133307252}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307281, function(require, module, exports) {
const urlutil = require('url');
const { isIP } = require('../utils/isIP');

const proto = exports;

/**
 * Get Object url by name
 * @param {String} name - object name
 * @param {String} [baseUrl] - If provide `baseUrl`, will use `baseUrl` instead the default `endpoint and bucket`.
 * @return {String} object url include bucket
 */
proto.generateObjectUrl = function generateObjectUrl(name, baseUrl) {
  if (isIP(this.options.endpoint.hostname)) {
    throw new Error('can not get the object URL when endpoint is IP');
  }
  if (!baseUrl) {
    baseUrl = this.options.endpoint.format();
    const copyUrl = urlutil.parse(baseUrl);
    const { bucket } = this.options;

    copyUrl.hostname = `${bucket}.${copyUrl.hostname}`;
    copyUrl.host = `${bucket}.${copyUrl.host}`;
    baseUrl = copyUrl.format();
  } else if (baseUrl[baseUrl.length - 1] !== '/') {
    baseUrl += '/';
  }
  return baseUrl + this._escape(this._objectName(name));
};

}, function(modId) { var map = {"../utils/isIP":1745133307248}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307282, function(require, module, exports) {
const { isIP } = require('../utils/isIP');

const proto = exports;
/**
 * Get Object url by name
 * @param {String} name - object name
 * @param {String} [baseUrl] - If provide `baseUrl`,
 *        will use `baseUrl` instead the default `endpoint`.
 * @return {String} object url
 */
proto.getObjectUrl = function getObjectUrl(name, baseUrl) {
  if (isIP(this.options.endpoint.hostname)) {
    throw new Error('can not get the object URL when endpoint is IP');
  }
  if (!baseUrl) {
    baseUrl = this.options.endpoint.format();
  } else if (baseUrl[baseUrl.length - 1] !== '/') {
    baseUrl += '/';
  }
  return baseUrl + this._escape(this._objectName(name));
};

}, function(modId) { var map = {"../utils/isIP":1745133307248}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307283, function(require, module, exports) {
const urlutil = require('url');
const utility = require('utility');
const copy = require('copy-to');
const signHelper = require('../../common/signUtils');
const { isIP } = require('../utils/isIP');

const proto = exports;

/**
 *  signatureUrl
 * @deprecated will be deprecated in 7.x
 * @param {String} name object name
 * @param {Object} options options
 * @param {boolean} [strictObjectNameValidation=true] the flag of verifying object name strictly
 */
proto.signatureUrl = function signatureUrl(name, options, strictObjectNameValidation = true) {
  if (isIP(this.options.endpoint.hostname)) {
    throw new Error('can not get the object URL when endpoint is IP');
  }

  if (strictObjectNameValidation && /^\?/.test(name)) {
    throw new Error(`Invalid object name ${name}`);
  }

  options = options || {};
  name = this._objectName(name);
  options.method = options.method || 'GET';
  const expires = utility.timestamp() + (options.expires || 1800);
  const params = {
    bucket: this.options.bucket,
    object: name
  };

  const resource = this._getResource(params);

  if (this.options.stsToken) {
    options['security-token'] = this.options.stsToken;
  }

  const signRes = signHelper._signatureForURL(this.options.accessKeySecret, options, resource, expires);

  const url = urlutil.parse(this._getReqUrl(params));
  url.query = {
    OSSAccessKeyId: this.options.accessKeyId,
    Expires: expires,
    Signature: signRes.Signature
  };

  copy(signRes.subResource).to(url.query);

  return url.format();
};

}, function(modId) { var map = {"../../common/signUtils":1745133307238,"../utils/isIP":1745133307248}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307284, function(require, module, exports) {
const urlutil = require('url');
const utility = require('utility');
const copy = require('copy-to');
const signHelper = require('../../common/signUtils');
const { isIP } = require('../utils/isIP');
const { setSTSToken } = require('../utils/setSTSToken');
const { isFunction } = require('../utils/isFunction');

const proto = exports;

/**
 * asyncSignatureUrl
 * @param {String} name object name
 * @param {Object} options options
 * @param {boolean} [strictObjectNameValidation=true] the flag of verifying object name strictly
 */
proto.asyncSignatureUrl = async function asyncSignatureUrl(name, options, strictObjectNameValidation = true) {
  if (isIP(this.options.endpoint.hostname)) {
    throw new Error('can not get the object URL when endpoint is IP');
  }

  if (strictObjectNameValidation && /^\?/.test(name)) {
    throw new Error(`Invalid object name ${name}`);
  }

  options = options || {};
  name = this._objectName(name);
  options.method = options.method || 'GET';
  const expires = utility.timestamp() + (options.expires || 1800);
  const params = {
    bucket: this.options.bucket,
    object: name
  };

  const resource = this._getResource(params);

  if (this.options.stsToken && isFunction(this.options.refreshSTSToken)) {
    await setSTSToken.call(this);
  }

  if (this.options.stsToken) {
    options['security-token'] = this.options.stsToken;
  }

  const signRes = signHelper._signatureForURL(this.options.accessKeySecret, options, resource, expires);

  const url = urlutil.parse(this._getReqUrl(params));
  url.query = {
    OSSAccessKeyId: this.options.accessKeyId,
    Expires: expires,
    Signature: signRes.Signature
  };

  copy(signRes.subResource).to(url.query);

  return url.format();
};

}, function(modId) { var map = {"../../common/signUtils":1745133307238,"../utils/isIP":1745133307248,"../utils/setSTSToken":1745133307251,"../utils/isFunction":1745133307254}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307285, function(require, module, exports) {
const dateFormat = require('dateformat');
const urlUtil = require('url');

const signHelper = require('../../common/signUtils');
const { setSTSToken } = require('../utils/setSTSToken');
const { isFunction } = require('../utils/isFunction');
const { getStandardRegion } = require('../utils/getStandardRegion');

const proto = exports;

/**
 * signatureUrlV4
 *
 * @param {string} method
 * @param {number} expires
 * @param {Object} [request]
 * @param {Object} [request.headers]
 * @param {Object} [request.queries]
 * @param {string} [objectName]
 * @param {string[]} [additionalHeaders]
 */
proto.signatureUrlV4 = async function signatureUrlV4(method, expires, request, objectName, additionalHeaders) {
  const headers = (request && request.headers) || {};
  const queries = Object.assign({}, (request && request.queries) || {});
  const date = new Date();
  const formattedDate = dateFormat(date, "UTC:yyyymmdd'T'HHMMss'Z'");
  const onlyDate = formattedDate.split('T')[0];
  const fixedAdditionalHeaders = signHelper.fixAdditionalHeaders(additionalHeaders);
  const region = getStandardRegion(this.options.region);

  if (fixedAdditionalHeaders.length > 0) {
    queries['x-oss-additional-headers'] = fixedAdditionalHeaders.join(';');
  }
  queries['x-oss-credential'] = signHelper.getCredential(onlyDate, region, this.options.accessKeyId);
  queries['x-oss-date'] = formattedDate;
  queries['x-oss-expires'] = expires;
  queries['x-oss-signature-version'] = 'OSS4-HMAC-SHA256';

  if (this.options.stsToken && isFunction(this.options.refreshSTSToken)) {
    await setSTSToken.call(this);
  }

  if (this.options.stsToken) {
    queries['x-oss-security-token'] = this.options.stsToken;
  }

  const canonicalRequest = signHelper.getCanonicalRequest(
    method,
    {
      headers,
      queries
    },
    this.options.bucket,
    objectName,
    fixedAdditionalHeaders
  );
  const stringToSign = signHelper.getStringToSign(region, formattedDate, canonicalRequest);

  queries['x-oss-signature'] = signHelper.getSignatureV4(this.options.accessKeySecret, onlyDate, region, stringToSign);

  const signedUrl = urlUtil.parse(
    this._getReqUrl({
      bucket: this.options.bucket,
      object: objectName
    })
  );
  signedUrl.query = Object.assign({}, queries);

  return signedUrl.format();
};

}, function(modId) { var map = {"../../common/signUtils":1745133307238,"../utils/setSTSToken":1745133307251,"../utils/isFunction":1745133307254,"../utils/getStandardRegion":1745133307255}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307286, function(require, module, exports) {

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signPostObjectPolicyV4 = void 0;
const dateformat_1 = __importDefault(require("dateformat"));
const getStandardRegion_1 = require("../utils/getStandardRegion");
const policy2Str_1 = require("../utils/policy2Str");
const signUtils_1 = require("../signUtils");
function signPostObjectPolicyV4(policy, date) {
    const policyStr = Buffer.from(policy2Str_1.policy2Str(policy), 'utf8').toString('base64');
    const formattedDate = dateformat_1.default(date, "UTC:yyyymmdd'T'HHMMss'Z'");
    const onlyDate = formattedDate.split('T')[0];
    const signature = signUtils_1.getSignatureV4(this.options.accessKeySecret, onlyDate, getStandardRegion_1.getStandardRegion(this.options.region), policyStr);
    return signature;
}
exports.signPostObjectPolicyV4 = signPostObjectPolicyV4;

}, function(modId) { var map = {"../utils/getStandardRegion":1745133307255,"../utils/policy2Str":1745133307262,"../signUtils":1745133307238}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307287, function(require, module, exports) {
const debug = require('debug')('ali-oss:object');
const fs = require('fs');
const is = require('is-type-of');
const copy = require('copy-to');
const path = require('path');
const mime = require('mime');
const callback = require('./common/callback');
const { Transform } = require('stream');
const pump = require('pump');
const { isBuffer } = require('./common/utils/isBuffer');
const { retry } = require('./common/utils/retry');
const { obj2xml } = require('./common/utils/obj2xml');
const { parseRestoreInfo } = require('./common/utils/parseRestoreInfo');

const proto = exports;

/**
 * Object operations
 */

/**
 * append an object from String(file path)/Buffer/ReadableStream
 * @param {String} name the object key
 * @param {Mixed} file String(file path)/Buffer/ReadableStream
 * @param {Object} options
 * @return {Object}
 */
proto.append = async function append(name, file, options) {
  options = options || {};
  if (options.position === undefined) options.position = '0';
  options.subres = {
    append: '',
    position: options.position
  };
  options.method = 'POST';

  const result = await this.put(name, file, options);
  result.nextAppendPosition = result.res.headers['x-oss-next-append-position'];
  return result;
};

/**
 * put an object from String(file path)/Buffer/ReadableStream
 * @param {String} name the object key
 * @param {Mixed} file String(file path)/Buffer/ReadableStream
 * @param {Object} options
 *        {Object} [options.callback] The callback parameter is composed of a JSON string encoded in Base64
 *        {String} options.callback.url  the OSS sends a callback request to this URL
 *        {String} [options.callback.host]  The host header value for initiating callback requests
 *        {String} options.callback.body  The value of the request body when a callback is initiated
 *        {String} [options.callback.contentType]  The Content-Type of the callback requests initiated
 *        {Boolean} [options.callback.callbackSNI] Whether OSS sends SNI to the origin address specified by callbackUrl when a callback request is initiated from the client
 *        {Object} [options.callback.customValue]  Custom parameters are a map of key-values, e.g:
 *                  customValue = {
 *                    key1: 'value1',
 *                    key2: 'value2'
 *                  }
 * @return {Object}
 */
proto.put = async function put(name, file, options) {
  let content;
  options = options || {};
  name = this._objectName(name);

  if (isBuffer(file)) {
    content = file;
  } else if (is.string(file)) {
    const stats = fs.statSync(file);
    if (!stats.isFile()) {
      throw new Error(`${file} is not file`);
    }
    options.mime = options.mime || mime.getType(path.extname(file));
    options.contentLength = await this._getFileSize(file);
    const getStream = () => fs.createReadStream(file);
    const putStreamStb = (objectName, makeStream, configOption) => {
      return this.putStream(objectName, makeStream(), configOption);
    };
    return await retry(putStreamStb, this.options.retryMax, {
      errorHandler: err => {
        const _errHandle = _err => {
          const statusErr = [-1, -2].includes(_err.status);
          const requestErrorRetryHandle = this.options.requestErrorRetryHandle || (() => true);
          return statusErr && requestErrorRetryHandle(_err);
        };
        if (_errHandle(err)) return true;
        return false;
      }
    })(name, getStream, options);
  } else if (is.readableStream(file)) {
    return await this.putStream(name, file, options);
  } else {
    throw new TypeError('Must provide String/Buffer/ReadableStream for put.');
  }

  options.headers = options.headers || {};
  this._convertMetaToHeaders(options.meta, options.headers);

  const method = options.method || 'PUT';
  const params = this._objectRequestParams(method, name, options);

  callback.encodeCallback(params, options);

  params.mime = options.mime;
  params.content = content;
  params.successStatuses = [200];

  const result = await this.request(params);

  const ret = {
    name,
    url: this._objectUrl(name),
    res: result.res
  };

  if (params.headers && params.headers['x-oss-callback']) {
    ret.data = JSON.parse(result.data.toString());
  }

  return ret;
};

/**
 * put an object from ReadableStream. If `options.contentLength` is
 * not provided, chunked encoding is used.
 * @param {String} name the object key
 * @param {Readable} stream the ReadableStream
 * @param {Object} options
 * @return {Object}
 */
proto.putStream = async function putStream(name, stream, options) {
  options = options || {};
  options.headers = options.headers || {};
  name = this._objectName(name);
  if (options.contentLength) {
    options.headers['Content-Length'] = options.contentLength;
  } else {
    options.headers['Transfer-Encoding'] = 'chunked';
  }
  this._convertMetaToHeaders(options.meta, options.headers);

  const method = options.method || 'PUT';
  const params = this._objectRequestParams(method, name, options);
  callback.encodeCallback(params, options);
  params.mime = options.mime;
  const transform = new Transform();
  // must remove http stream header for signature
  transform._transform = function _transform(chunk, encoding, done) {
    this.push(chunk);
    done();
  };
  params.stream = pump(stream, transform);
  params.successStatuses = [200];

  const result = await this.request(params);

  const ret = {
    name,
    url: this._objectUrl(name),
    res: result.res
  };

  if (params.headers && params.headers['x-oss-callback']) {
    ret.data = JSON.parse(result.data.toString());
  }

  return ret;
};

proto.getStream = async function getStream(name, options) {
  options = options || {};

  if (options.process) {
    options.subres = options.subres || {};
    options.subres['x-oss-process'] = options.process;
  }

  const params = this._objectRequestParams('GET', name, options);
  params.customResponse = true;
  params.successStatuses = [200, 206, 304];

  const result = await this.request(params);

  return {
    stream: result.res,
    res: {
      status: result.status,
      headers: result.headers
    }
  };
};

proto.putMeta = async function putMeta(name, meta, options) {
  return await this.copy(name, name, {
    meta: meta || {},
    timeout: options && options.timeout,
    ctx: options && options.ctx
  });
};

proto.list = async function list(query, options) {
  // prefix, marker, max-keys, delimiter

  const params = this._objectRequestParams('GET', '', options);
  params.query = query;
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);
  let objects = result.data.Contents || [];
  const that = this;
  if (objects) {
    if (!Array.isArray(objects)) {
      objects = [objects];
    }

    objects = objects.map(obj => ({
      name: obj.Key,
      url: that._objectUrl(obj.Key),
      lastModified: obj.LastModified,
      etag: obj.ETag,
      type: obj.Type,
      size: Number(obj.Size),
      storageClass: obj.StorageClass,
      owner: {
        id: obj.Owner.ID,
        displayName: obj.Owner.DisplayName
      },
      restoreInfo: parseRestoreInfo(obj.RestoreInfo)
    }));
  }
  let prefixes = result.data.CommonPrefixes || null;
  if (prefixes) {
    if (!Array.isArray(prefixes)) {
      prefixes = [prefixes];
    }
    prefixes = prefixes.map(item => item.Prefix);
  }
  return {
    res: result.res,
    objects,
    prefixes,
    nextMarker: result.data.NextMarker || null,
    isTruncated: result.data.IsTruncated === 'true'
  };
};

proto.listV2 = async function listV2(query = {}, options = {}) {
  const continuation_token = query['continuation-token'] || query.continuationToken;
  delete query['continuation-token'];
  delete query.continuationToken;
  if (continuation_token) {
    options.subres = Object.assign(
      {
        'continuation-token': continuation_token
      },
      options.subres
    );
  }
  const params = this._objectRequestParams('GET', '', options);
  params.query = Object.assign({ 'list-type': 2 }, query);
  delete params.query['continuation-token'];
  delete query.continuationToken;
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);
  let objects = result.data.Contents || [];
  const that = this;
  if (objects) {
    if (!Array.isArray(objects)) {
      objects = [objects];
    }

    objects = objects.map(obj => {
      let owner = null;
      if (obj.Owner) {
        owner = {
          id: obj.Owner.ID,
          displayName: obj.Owner.DisplayName
        };
      }

      return {
        name: obj.Key,
        url: that._objectUrl(obj.Key),
        lastModified: obj.LastModified,
        etag: obj.ETag,
        type: obj.Type,
        size: Number(obj.Size),
        storageClass: obj.StorageClass,
        owner,
        restoreInfo: parseRestoreInfo(obj.RestoreInfo)
      };
    });
  }
  let prefixes = result.data.CommonPrefixes || null;
  if (prefixes) {
    if (!Array.isArray(prefixes)) {
      prefixes = [prefixes];
    }
    prefixes = prefixes.map(item => item.Prefix);
  }
  return {
    res: result.res,
    objects,
    prefixes,
    isTruncated: result.data.IsTruncated === 'true',
    keyCount: +result.data.KeyCount,
    continuationToken: result.data.ContinuationToken || null,
    nextContinuationToken: result.data.NextContinuationToken || null
  };
};

/**
 * Restore Object
 * @param {String} name the object key
 * @param {Object} options {type : Archive or ColdArchive}
 * @returns {{res}}
 */
proto.restore = async function restore(name, options = { type: 'Archive' }) {
  options = options || {};
  options.subres = Object.assign({ restore: '' }, options.subres);
  if (options.versionId) {
    options.subres.versionId = options.versionId;
  }
  const params = this._objectRequestParams('POST', name, options);
  const paramsXMLObj = {
    RestoreRequest: {
      Days: options.Days ? options.Days : 2
    }
  };

  if (options.type === 'ColdArchive' || options.type === 'DeepColdArchive') {
    paramsXMLObj.RestoreRequest.JobParameters = {
      Tier: options.JobParameters ? options.JobParameters : 'Standard'
    };
  }

  params.content = obj2xml(paramsXMLObj, {
    headers: true
  });
  params.mime = 'xml';
  params.successStatuses = [202];

  const result = await this.request(params);

  return {
    res: result.res
  };
};

proto._objectUrl = function _objectUrl(name) {
  return this._getReqUrl({ bucket: this.options.bucket, object: name });
};

/**
 * generator request params
 * @return {Object} params
 *
 * @api private
 */

proto._objectRequestParams = function (method, name, options) {
  if (!this.options.bucket && !this.options.cname) {
    throw new Error('Please create a bucket first');
  }

  options = options || {};
  name = this._objectName(name);
  const params = {
    object: name,
    bucket: this.options.bucket,
    method,
    subres: options && options.subres,
    additionalHeaders: options && options.additionalHeaders,
    timeout: options && options.timeout,
    ctx: options && options.ctx
  };

  if (options.headers) {
    params.headers = {};
    copy(options.headers).to(params.headers);
  }
  return params;
};

proto._objectName = function (name) {
  return name.replace(/^\/+/, '');
};

proto._statFile = function (filepath) {
  return new Promise((resolve, reject) => {
    fs.stat(filepath, (err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(stats);
      }
    });
  });
};

proto._convertMetaToHeaders = function (meta, headers) {
  if (!meta) {
    return;
  }

  Object.keys(meta).forEach(k => {
    headers[`x-oss-meta-${k}`] = meta[k];
  });
};

proto._deleteFileSafe = function (filepath) {
  return new Promise(resolve => {
    fs.exists(filepath, exists => {
      if (!exists) {
        resolve();
      } else {
        fs.unlink(filepath, err => {
          if (err) {
            debug('unlink %j error: %s', filepath, err);
          }
          resolve();
        });
      }
    });
  });
};

}, function(modId) { var map = {"./common/callback":1745133307288,"./common/utils/isBuffer":1745133307289,"./common/utils/retry":1745133307253,"./common/utils/obj2xml":1745133307265,"./common/utils/parseRestoreInfo":1745133307271}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307288, function(require, module, exports) {
exports.encodeCallback = function encodeCallback(reqParams, options) {
  reqParams.headers = reqParams.headers || {};
  if (!Object.prototype.hasOwnProperty.call(reqParams.headers, 'x-oss-callback')) {
    if (options.callback) {
      const json = {
        callbackUrl: encodeURI(options.callback.url),
        callbackBody: options.callback.body
      };
      if (options.callback.host) {
        json.callbackHost = options.callback.host;
      }
      if (options.callback.contentType) {
        json.callbackBodyType = options.callback.contentType;
      }
      if (options.callback.callbackSNI) {
        json.callbackSNI = options.callback.callbackSNI;
      }
      const callback = Buffer.from(JSON.stringify(json)).toString('base64');
      reqParams.headers['x-oss-callback'] = callback;

      if (options.callback.customValue) {
        const callbackVar = {};
        Object.keys(options.callback.customValue).forEach(key => {
          callbackVar[`x:${key}`] = options.callback.customValue[key].toString();
        });
        reqParams.headers['x-oss-callback-var'] = Buffer.from(JSON.stringify(callbackVar)).toString('base64');
      }
    }
  }
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307289, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.isBuffer = void 0;
function isBuffer(obj) {
    return Buffer.isBuffer(obj);
}
exports.isBuffer = isBuffer;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307290, function(require, module, exports) {
const merge = require('merge-descriptors');

const proto = exports;

merge(proto, require('./processObjectSave'));

}, function(modId) { var map = {"./processObjectSave":1745133307291}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307291, function(require, module, exports) {
/* eslint-disable no-use-before-define */
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const querystring = require('querystring');
const {
  Base64: { encode: str2Base64 }
} = require('js-base64');

const proto = exports;

proto.processObjectSave = async function processObjectSave(sourceObject, targetObject, process, targetBucket) {
  checkArgs(sourceObject, 'sourceObject');
  checkArgs(targetObject, 'targetObject');
  checkArgs(process, 'process');
  targetObject = this._objectName(targetObject);
  if (targetBucket) {
    _checkBucketName(targetBucket);
  }

  const params = this._objectRequestParams('POST', sourceObject, {
    subres: 'x-oss-process'
  });

  const bucketParam = targetBucket ? `,b_${str2Base64(targetBucket)}` : '';
  targetObject = str2Base64(targetObject);

  const content = {
    'x-oss-process': `${process}|sys/saveas,o_${targetObject}${bucketParam}`
  };
  params.content = querystring.stringify(content);

  const result = await this.request(params);
  return {
    res: result.res,
    status: result.res.status
  };
};

function checkArgs(name, key) {
  if (!name) {
    throw new Error(`${key} is required`);
  }
  if (typeof name !== 'string') {
    throw new Error(`${key} must be String`);
  }
}

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307292, function(require, module, exports) {
const merge = require('merge-descriptors');

const proto = exports;

merge(proto, require('./getBucketRequestPayment'));
merge(proto, require('./putBucketRequestPayment'));
merge(proto, require('./putBucketEncryption'));
merge(proto, require('./getBucketEncryption'));
merge(proto, require('./deleteBucketEncryption'));
merge(proto, require('./getBucketTags'));
merge(proto, require('./putBucketTags'));
merge(proto, require('./deleteBucketTags'));
merge(proto, require('./putBucket'));
merge(proto, require('./getBucketWebsite'));
merge(proto, require('./putBucketWebsite'));
merge(proto, require('./deleteBucketWebsite'));
merge(proto, require('./getBucketLifecycle'));
merge(proto, require('./putBucketLifecycle'));
merge(proto, require('./deleteBucketLifecycle'));
merge(proto, require('./getBucketPolicy'));
merge(proto, require('./putBucketPolicy'));
merge(proto, require('./deleteBucketPolicy'));
merge(proto, require('./getBucketVersioning'));
merge(proto, require('./putBucketVersioning'));
merge(proto, require('./getBucketInventory'));
merge(proto, require('./deleteBucketInventory'));
merge(proto, require('./listBucketInventory'));
merge(proto, require('./putBucketInventory'));
merge(proto, require('./abortBucketWorm'));
merge(proto, require('./completeBucketWorm'));
merge(proto, require('./extendBucketWorm'));
merge(proto, require('./getBucketWorm'));
merge(proto, require('./initiateBucketWorm'));
merge(proto, require('./getBucketStat'));

}, function(modId) { var map = {"./getBucketRequestPayment":1745133307293,"./putBucketRequestPayment":1745133307294,"./putBucketEncryption":1745133307295,"./getBucketEncryption":1745133307296,"./deleteBucketEncryption":1745133307297,"./getBucketTags":1745133307298,"./putBucketTags":1745133307300,"./deleteBucketTags":1745133307302,"./putBucket":1745133307303,"./getBucketWebsite":1745133307304,"./putBucketWebsite":1745133307305,"./deleteBucketWebsite":1745133307306,"./getBucketLifecycle":1745133307307,"./putBucketLifecycle":1745133307308,"./deleteBucketLifecycle":1745133307311,"./getBucketPolicy":1745133307312,"./putBucketPolicy":1745133307313,"./deleteBucketPolicy":1745133307314,"./getBucketVersioning":1745133307315,"./putBucketVersioning":1745133307316,"./getBucketInventory":1745133307317,"./deleteBucketInventory":1745133307320,"./listBucketInventory":1745133307321,"./putBucketInventory":1745133307322,"./abortBucketWorm":1745133307323,"./completeBucketWorm":1745133307324,"./extendBucketWorm":1745133307325,"./getBucketWorm":1745133307326,"./initiateBucketWorm":1745133307327,"./getBucketStat":1745133307328}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307293, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');

const proto = exports;
/**
 * getBucketRequestPayment
 * @param {String} bucketName - bucket name
 * @param {Object} options
 */

proto.getBucketRequestPayment = async function getBucketRequestPayment(bucketName, options) {
  options = options || {};

  _checkBucketName(bucketName);
  const params = this._bucketRequestParams('GET', bucketName, 'requestPayment', options);
  params.successStatuses = [200];
  params.xmlResponse = true;

  const result = await this.request(params);

  return {
    status: result.status,
    res: result.res,
    payer: result.data.Payer
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307294, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { obj2xml } = require('../utils/obj2xml');

const proto = exports;
/**
 * putBucketRequestPayment
 * @param {String} bucketName
 * @param {String} payer
 * @param {Object} options
 */
const payerAll = ['BucketOwner', 'Requester'];

proto.putBucketRequestPayment = async function putBucketRequestPayment(bucketName, payer, options) {
  options = options || {};
  if (!payer || payerAll.indexOf(payer) < 0) {
    throw new Error('payer must be BucketOwner or Requester');
  }

  _checkBucketName(bucketName);
  const params = this._bucketRequestParams('PUT', bucketName, 'requestPayment', options);
  params.successStatuses = [200];

  const paramXMLObj = {
    RequestPaymentConfiguration: {
      Payer: payer
    }
  };
  const paramXML = obj2xml(paramXMLObj, {
    headers: true
  });

  params.mime = 'xml';
  params.content = paramXML;

  const result = await this.request(params);
  return {
    status: result.status,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/obj2xml":1745133307265}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307295, function(require, module, exports) {
const proto = exports;
// const jstoxml = require('jstoxml');
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { obj2xml } = require('../utils/obj2xml');
/**
 * putBucketEncryption
 * @param {String} bucketName - bucket name
 * @param {Object} options
 */

proto.putBucketEncryption = async function putBucketEncryption(bucketName, options) {
  options = options || {};
  _checkBucketName(bucketName);
  const params = this._bucketRequestParams('PUT', bucketName, 'encryption', options);
  params.successStatuses = [200];
  const paramXMLObj = {
    ServerSideEncryptionRule: {
      ApplyServerSideEncryptionByDefault: {
        SSEAlgorithm: options.SSEAlgorithm
      }
    }
  };
  if (options.KMSMasterKeyID !== undefined) {
    paramXMLObj.ServerSideEncryptionRule.ApplyServerSideEncryptionByDefault.KMSMasterKeyID = options.KMSMasterKeyID;
  }
  const paramXML = obj2xml(paramXMLObj, {
    headers: true
  });
  params.mime = 'xml';
  params.content = paramXML;
  const result = await this.request(params);
  return {
    status: result.status,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/obj2xml":1745133307265}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307296, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');

const proto = exports;
/**
 * getBucketEncryption
 * @param {String} bucketName - bucket name
 */

proto.getBucketEncryption = async function getBucketEncryption(bucketName) {
  _checkBucketName(bucketName);
  const params = this._bucketRequestParams('GET', bucketName, 'encryption');
  params.successStatuses = [200];
  params.xmlResponse = true;
  const result = await this.request(params);
  const encryption = result.data.ApplyServerSideEncryptionByDefault;
  return {
    encryption,
    status: result.status,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307297, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');

const proto = exports;
// const jstoxml = require('jstoxml');
/**
 * deleteBucketEncryption
 * @param {String} bucketName - bucket name
 */

proto.deleteBucketEncryption = async function deleteBucketEncryption(bucketName) {
  _checkBucketName(bucketName);
  const params = this._bucketRequestParams('DELETE', bucketName, 'encryption');
  params.successStatuses = [204];
  params.xmlResponse = true;
  const result = await this.request(params);
  return {
    status: result.status,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307298, function(require, module, exports) {
const proto = exports;
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { formatTag } = require('../utils/formatTag');
/**
 * getBucketTags
 * @param {String} name - bucket name
 * @param {Object} options
 * @return {Object}
 */

proto.getBucketTags = async function getBucketTags(name, options = {}) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('GET', name, 'tagging', options);
  params.successStatuses = [200];
  const result = await this.request(params);
  const Tagging = await this.parseXML(result.data);

  return {
    status: result.status,
    res: result.res,
    tag: formatTag(Tagging)
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/formatTag":1745133307299}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307299, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTag = void 0;
const isObject_1 = require("./isObject");
function formatTag(obj) {
    if (obj.Tagging !== undefined) {
        obj = obj.Tagging.TagSet.Tag;
    }
    else if (obj.TagSet !== undefined) {
        obj = obj.TagSet.Tag;
    }
    else if (obj.Tag !== undefined) {
        obj = obj.Tag;
    }
    obj = obj && isObject_1.isObject(obj) ? [obj] : obj || [];
    const tag = {};
    obj.forEach(item => {
        tag[item.Key] = item.Value;
    });
    return tag;
}
exports.formatTag = formatTag;

}, function(modId) { var map = {"./isObject":1745133307240}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307300, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { obj2xml } = require('../utils/obj2xml');
const { checkBucketTag } = require('../utils/checkBucketTag');

const proto = exports;
/**
 * putBucketTags
 * @param {String} name - bucket name
 * @param {Object} tag -  bucket tag, eg: `{a: "1", b: "2"}`
 * @param {Object} options
 */

proto.putBucketTags = async function putBucketTags(name, tag, options = {}) {
  _checkBucketName(name);
  checkBucketTag(tag);
  const params = this._bucketRequestParams('PUT', name, 'tagging', options);
  params.successStatuses = [200];
  tag = Object.keys(tag).map(key => ({
    Key: key,
    Value: tag[key]
  }));

  const paramXMLObj = {
    Tagging: {
      TagSet: {
        Tag: tag
      }
    }
  };

  params.mime = 'xml';
  params.content = obj2xml(paramXMLObj);

  const result = await this.request(params);
  return {
    res: result.res,
    status: result.status
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/obj2xml":1745133307265,"../utils/checkBucketTag":1745133307301}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307301, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBucketTag = void 0;
const { checkValid } = require('./checkValid');
const { isObject } = require('./isObject');
const commonRules = [
    {
        validator: value => {
            if (typeof value !== 'string') {
                throw new Error('the key and value of the tag must be String');
            }
        }
    }
];
const rules = {
    key: [
        ...commonRules,
        {
            pattern: /^.{1,64}$/,
            msg: 'tag key can be a maximum of 64 bytes in length'
        },
        {
            pattern: /^(?!https*:\/\/|Aliyun)/,
            msg: 'tag key can not startsWith: http://, https://, Aliyun'
        }
    ],
    value: [
        ...commonRules,
        {
            pattern: /^.{0,128}$/,
            msg: 'tag value can be a maximum of 128 bytes in length'
        }
    ]
};
exports.checkBucketTag = (tag) => {
    if (!isObject(tag)) {
        throw new Error('bucket tag must be Object');
    }
    const entries = Object.entries(tag);
    if (entries.length > 20) {
        throw new Error('maximum of 20 tags for a bucket');
    }
    const rulesIndexKey = ['key', 'value'];
    entries.forEach(keyValue => {
        keyValue.forEach((item, index) => {
            checkValid(item, rules[rulesIndexKey[index]]);
        });
    });
};

}, function(modId) { var map = {"./checkValid":1745133307267,"./isObject":1745133307240}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307302, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');

const proto = exports;
/**
 * deleteBucketTags
 * @param {String} name - bucket name
 * @param {Object} options
 */

proto.deleteBucketTags = async function deleteBucketTags(name, options = {}) {
  _checkBucketName(name);

  const params = this._bucketRequestParams('DELETE', name, 'tagging', options);
  params.successStatuses = [204];
  const result = await this.request(params);

  return {
    status: result.status,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307303, function(require, module, exports) {
const proto = exports;
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { obj2xml } = require('../utils/obj2xml');

proto.putBucket = async function putBucket(name, options = {}) {
  _checkBucketName(name, true);
  const params = this._bucketRequestParams('PUT', name, '', options);

  const CreateBucketConfiguration = {};
  const paramlXMLObJ = {
    CreateBucketConfiguration
  };

  const storageClass = options.StorageClass || options.storageClass;
  const dataRedundancyType = options.DataRedundancyType || options.dataRedundancyType;
  if (storageClass || dataRedundancyType) {
    storageClass && (CreateBucketConfiguration.StorageClass = storageClass);
    dataRedundancyType && (CreateBucketConfiguration.DataRedundancyType = dataRedundancyType);
    params.mime = 'xml';
    params.content = obj2xml(paramlXMLObJ, { headers: true });
  }
  const { acl, headers = {} } = options;
  acl && (headers['x-oss-acl'] = acl);
  params.headers = headers;
  params.successStatuses = [200];
  const result = await this.request(params);
  return {
    bucket: (result.headers.location && result.headers.location.substring(1)) || null,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/obj2xml":1745133307265}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307304, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { isObject } = require('../utils/isObject');

const proto = exports;

proto.getBucketWebsite = async function getBucketWebsite(name, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('GET', name, 'website', options);
  params.successStatuses = [200];
  params.xmlResponse = true;
  const result = await this.request(params);
  let routingRules = [];
  if (result.data.RoutingRules && result.data.RoutingRules.RoutingRule) {
    if (isObject(result.data.RoutingRules.RoutingRule)) {
      routingRules = [result.data.RoutingRules.RoutingRule];
    } else {
      routingRules = result.data.RoutingRules.RoutingRule;
    }
  }
  return {
    index: (result.data.IndexDocument && result.data.IndexDocument.Suffix) || '',
    supportSubDir: (result.data.IndexDocument && result.data.IndexDocument.SupportSubDir) || 'false',
    type: result.data.IndexDocument && result.data.IndexDocument.Type,
    routingRules,
    error: (result.data.ErrorDocument && result.data.ErrorDocument.Key) || null,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/isObject":1745133307240}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307305, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { obj2xml } = require('../utils/obj2xml');
const { isArray } = require('../utils/isArray');

const proto = exports;
proto.putBucketWebsite = async function putBucketWebsite(name, config = {}, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('PUT', name, 'website', options);
  const IndexDocument = {
    Suffix: config.index || 'index.html'
  };
  const WebsiteConfiguration = {
    IndexDocument
  };
  let website = {
    WebsiteConfiguration
  };

  if (config.supportSubDir) {
    IndexDocument.SupportSubDir = config.supportSubDir;
  }

  if (config.type) {
    IndexDocument.Type = config.type;
  }

  if (config.error) {
    WebsiteConfiguration.ErrorDocument = {
      Key: config.error
    };
  }

  if (config.routingRules !== undefined) {
    if (!isArray(config.routingRules)) {
      throw new Error('RoutingRules must be Array');
    }
    WebsiteConfiguration.RoutingRules = {
      RoutingRule: config.routingRules
    };
  }

  website = obj2xml(website);
  params.content = website;
  params.mime = 'xml';
  params.successStatuses = [200];
  const result = await this.request(params);
  return {
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/obj2xml":1745133307265,"../utils/isArray":1745133307270}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307306, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');

const proto = exports;

proto.deleteBucketWebsite = async function deleteBucketWebsite(name, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('DELETE', name, 'website', options);
  params.successStatuses = [204];
  const result = await this.request(params);
  return {
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307307, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { isArray } = require('../utils/isArray');
const { formatObjKey } = require('../utils/formatObjKey');

const proto = exports;

proto.getBucketLifecycle = async function getBucketLifecycle(name, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('GET', name, 'lifecycle', options);
  params.successStatuses = [200];
  params.xmlResponse = true;
  const result = await this.request(params);
  let rules = result.data.Rule || null;
  if (rules) {
    if (!isArray(rules)) {
      rules = [rules];
    }
    rules = rules.map(_ => {
      if (_.ID) {
        _.id = _.ID;
        delete _.ID;
      }
      if (_.Tag && !isArray(_.Tag)) {
        _.Tag = [_.Tag];
      }
      return formatObjKey(_, 'firstLowerCase');
    });
  }
  return {
    rules,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/isArray":1745133307270,"../utils/formatObjKey":1745133307252}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307308, function(require, module, exports) {
/* eslint-disable no-use-before-define */
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { isArray } = require('../utils/isArray');
const { deepCopy } = require('../utils/deepCopy');
const { isObject } = require('../utils/isObject');
const { obj2xml } = require('../utils/obj2xml');
const { checkObjectTag } = require('../utils/checkObjectTag');
const { getStrBytesCount } = require('../utils/getStrBytesCount');

const proto = exports;

proto.putBucketLifecycle = async function putBucketLifecycle(name, rules, options) {
  _checkBucketName(name);

  if (!isArray(rules)) {
    throw new Error('rules must be Array');
  }

  const params = this._bucketRequestParams('PUT', name, 'lifecycle', options);
  const Rule = [];
  const paramXMLObj = {
    LifecycleConfiguration: {
      Rule
    }
  };

  rules.forEach(_ => {
    defaultDaysAndDate2Expiration(_); // todo delete, 兼容旧版本
    checkRule(_);
    if (_.id) {
      _.ID = _.id;
      delete _.id;
    }
    Rule.push(_);
  });

  const paramXML = obj2xml(paramXMLObj, {
    headers: true,
    firstUpperCase: true
  });

  params.content = paramXML;
  params.mime = 'xml';
  params.successStatuses = [200];
  const result = await this.request(params);
  return {
    res: result.res
  };
};

// todo delete, 兼容旧版本
function defaultDaysAndDate2Expiration(obj) {
  if (obj.days) {
    obj.expiration = {
      days: obj.days
    };
  }
  if (obj.date) {
    obj.expiration = {
      createdBeforeDate: obj.date
    };
  }
}

function checkDaysAndDate(obj, key) {
  const { days, createdBeforeDate } = obj;
  if (!days && !createdBeforeDate) {
    throw new Error(`${key} must includes days or createdBeforeDate`);
  } else if (days && (isArray(days) || !/^[1-9][0-9]*$/.test(days))) {
    throw new Error('days must be a positive integer');
  } else if (createdBeforeDate && !/\d{4}-\d{2}-\d{2}T00:00:00.000Z/.test(createdBeforeDate)) {
    throw new Error('createdBeforeDate must be date and conform to iso8601 format');
  }
}

function checkNoncurrentDays(obj, key) {
  const { noncurrentDays } = obj;
  if (!noncurrentDays) {
    throw new Error(`${key} must includes noncurrentDays`);
  } else if (noncurrentDays && (isArray(noncurrentDays) || !/^[1-9][0-9]*$/.test(noncurrentDays))) {
    throw new Error('noncurrentDays must be a positive integer');
  }
}

function handleCheckTag(tag) {
  if (!isArray(tag) && !isObject(tag)) {
    throw new Error('tag must be Object or Array');
  }
  tag = isObject(tag) ? [tag] : tag;
  const tagObj = {};
  const tagClone = deepCopy(tag);
  tagClone.forEach(v => {
    tagObj[v.key] = v.value;
  });

  checkObjectTag(tagObj);
}

function checkStorageClass(storageClass) {
  if (!['IA', 'Archive', 'ColdArchive', 'DeepColdArchive'].includes(storageClass))
    throw new Error(`StorageClass must be IA or Archive or ColdArchive or DeepColdArchive`);
}

function checkRule(rule) {
  if (rule.id && getStrBytesCount(rule.id) > 255) throw new Error('ID is composed of 255 bytes at most');

  if (rule.prefix === undefined) throw new Error('Rule must includes prefix');

  if (!['Enabled', 'Disabled'].includes(rule.status)) throw new Error('Status must be Enabled or Disabled');

  if (
    !rule.expiration &&
    !rule.noncurrentVersionExpiration &&
    !rule.abortMultipartUpload &&
    !rule.transition &&
    !rule.noncurrentVersionTransition
  ) {
    throw new Error(
      'Rule must includes expiration or noncurrentVersionExpiration or abortMultipartUpload or transition or noncurrentVersionTransition'
    );
  }

  if (rule.transition) {
    checkStorageClass(rule.transition.storageClass);
    checkDaysAndDate(rule.transition, 'Transition');
  }

  if (rule.expiration) {
    if (!rule.expiration.expiredObjectDeleteMarker) {
      checkDaysAndDate(rule.expiration, 'Expiration');
    } else if (rule.expiration.days || rule.expiration.createdBeforeDate) {
      throw new Error('expiredObjectDeleteMarker cannot be used with days or createdBeforeDate');
    }
  }

  if (rule.abortMultipartUpload) {
    checkDaysAndDate(rule.abortMultipartUpload, 'AbortMultipartUpload');
  }

  if (rule.noncurrentVersionTransition) {
    checkStorageClass(rule.noncurrentVersionTransition.storageClass);
    checkNoncurrentDays(rule.noncurrentVersionTransition, 'NoncurrentVersionTransition');
  }

  if (rule.noncurrentVersionExpiration) {
    checkNoncurrentDays(rule.noncurrentVersionExpiration, 'NoncurrentVersionExpiration');
  }

  if (rule.tag) {
    if (rule.abortMultipartUpload) {
      throw new Error('Tag cannot be used with abortMultipartUpload');
    }
    handleCheckTag(rule.tag);
  }
}

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/isArray":1745133307270,"../utils/deepCopy":1745133307309,"../utils/isObject":1745133307240,"../utils/obj2xml":1745133307265,"../utils/checkObjectTag":1745133307266,"../utils/getStrBytesCount":1745133307310}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307309, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.deepCopyWith = exports.deepCopy = void 0;
const isBuffer_1 = require("./isBuffer");
exports.deepCopy = obj => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (isBuffer_1.isBuffer(obj)) {
        return obj.slice();
    }
    const copy = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach(key => {
        copy[key] = exports.deepCopy(obj[key]);
    });
    return copy;
};
exports.deepCopyWith = (obj, customizer) => {
    function deepCopyWithHelper(value, innerKey, innerObject) {
        const result = customizer(value, innerKey, innerObject);
        if (result !== undefined)
            return result;
        if (value === null || typeof value !== 'object') {
            return value;
        }
        if (isBuffer_1.isBuffer(value)) {
            return value.slice();
        }
        const copy = Array.isArray(value) ? [] : {};
        Object.keys(value).forEach(k => {
            copy[k] = deepCopyWithHelper(value[k], k, value);
        });
        return copy;
    }
    if (customizer) {
        return deepCopyWithHelper(obj, '', null);
    }
    else {
        return exports.deepCopy(obj);
    }
};

}, function(modId) { var map = {"./isBuffer":1745133307289}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307310, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.getStrBytesCount = void 0;
function getStrBytesCount(str) {
    let bytesCount = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charAt(i);
        if (/^[\u00-\uff]$/.test(c)) {
            bytesCount += 1;
        }
        else {
            bytesCount += 2;
        }
    }
    return bytesCount;
}
exports.getStrBytesCount = getStrBytesCount;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307311, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');

const proto = exports;

proto.deleteBucketLifecycle = async function deleteBucketLifecycle(name, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('DELETE', name, 'lifecycle', options);
  params.successStatuses = [204];
  const result = await this.request(params);
  return {
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307312, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');

const proto = exports;
/**
 * getBucketPolicy
 * @param {String} bucketName - bucket name
 * @param {Object} options
 */

proto.getBucketPolicy = async function getBucketPolicy(bucketName, options = {}) {
  _checkBucketName(bucketName);

  const params = this._bucketRequestParams('GET', bucketName, 'policy', options);

  const result = await this.request(params);
  params.successStatuses = [200];
  let policy = null;

  if (result.res.status === 200) {
    policy = JSON.parse(result.res.data.toString());
  }

  return {
    policy,
    status: result.status,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307313, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { policy2Str } = require('../utils/policy2Str');
const { isObject } = require('../utils/isObject');

const proto = exports;
/**
 * putBucketPolicy
 * @param {String} bucketName - bucket name
 * @param {Object} policy - bucket policy
 * @param {Object} options
 */

proto.putBucketPolicy = async function putBucketPolicy(bucketName, policy, options = {}) {
  _checkBucketName(bucketName);

  if (!isObject(policy)) {
    throw new Error('policy is not Object');
  }
  const params = this._bucketRequestParams('PUT', bucketName, 'policy', options);
  params.content = policy2Str(policy);
  params.successStatuses = [200];
  const result = await this.request(params);
  return {
    status: result.status,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/policy2Str":1745133307262,"../utils/isObject":1745133307240}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307314, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');

const proto = exports;
/**
 * deleteBucketPolicy
 * @param {String} bucketName - bucket name
 * @param {Object} options
 */

proto.deleteBucketPolicy = async function deleteBucketPolicy(bucketName, options = {}) {
  _checkBucketName(bucketName);

  const params = this._bucketRequestParams('DELETE', bucketName, 'policy', options);
  params.successStatuses = [204];
  const result = await this.request(params);

  return {
    status: result.status,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307315, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');

const proto = exports;
/**
 * getBucketVersioning
 * @param {String} bucketName - bucket name
 */

proto.getBucketVersioning = async function getBucketVersioning(bucketName, options) {
  _checkBucketName(bucketName);
  const params = this._bucketRequestParams('GET', bucketName, 'versioning', options);
  params.xmlResponse = true;
  params.successStatuses = [200];
  const result = await this.request(params);

  const versionStatus = result.data.Status;
  return {
    status: result.status,
    versionStatus,
    res: result.res
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307316, function(require, module, exports) {
const { checkBucketName: _checkBucketName } = require('../utils/checkBucketName');
const { obj2xml } = require('../utils/obj2xml');

const proto = exports;
/**
 * putBucketVersioning
 * @param {String} name - bucket name
 * @param {String} status
 * @param {Object} options
 */

proto.putBucketVersioning = async function putBucketVersioning(name, status, options = {}) {
  _checkBucketName(name);
  if (!['Enabled', 'Suspended'].includes(status)) {
    throw new Error('status must be Enabled or Suspended');
  }
  const params = this._bucketRequestParams('PUT', name, 'versioning', options);

  const paramXMLObj = {
    VersioningConfiguration: {
      Status: status
    }
  };

  params.mime = 'xml';
  params.content = obj2xml(paramXMLObj, {
    headers: true
  });

  const result = await this.request(params);
  return {
    res: result.res,
    status: result.status
  };
};

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/obj2xml":1745133307265}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307317, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.getBucketInventory = void 0;
const checkBucketName_1 = require("../utils/checkBucketName");
const formatInventoryConfig_1 = require("../utils/formatInventoryConfig");
/**
 * getBucketInventory
 * @param {String} bucketName - bucket name
 * @param {String} inventoryId
 * @param {Object} options
 */
async function getBucketInventory(bucketName, inventoryId, options = {}) {
    const subres = Object.assign({ inventory: '', inventoryId }, options.subres);
    checkBucketName_1.checkBucketName(bucketName);
    const params = this._bucketRequestParams('GET', bucketName, subres, options);
    params.successStatuses = [200];
    params.xmlResponse = true;
    const result = await this.request(params);
    return {
        status: result.status,
        res: result.res,
        inventory: formatInventoryConfig_1.formatInventoryConfig(result.data)
    };
}
exports.getBucketInventory = getBucketInventory;

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/formatInventoryConfig":1745133307318}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307318, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.formatInventoryConfig = void 0;
const dataFix_1 = require("../utils/dataFix");
const isObject_1 = require("../utils/isObject");
const isArray_1 = require("../utils/isArray");
const formatObjKey_1 = require("../utils/formatObjKey");
function formatInventoryConfig(inventoryConfig, toArray = false) {
    if (toArray && isObject_1.isObject(inventoryConfig))
        inventoryConfig = [inventoryConfig];
    if (isArray_1.isArray(inventoryConfig)) {
        inventoryConfig = inventoryConfig.map(formatFn);
    }
    else {
        inventoryConfig = formatFn(inventoryConfig);
    }
    return inventoryConfig;
}
exports.formatInventoryConfig = formatInventoryConfig;
function formatFn(_) {
    dataFix_1.dataFix(_, { bool: ['IsEnabled'] }, conf => {
        var _a, _b;
        // prefix
        conf.prefix = conf.Filter.Prefix;
        delete conf.Filter;
        // OSSBucketDestination
        conf.OSSBucketDestination = conf.Destination.OSSBucketDestination;
        // OSSBucketDestination.rolename
        conf.OSSBucketDestination.rolename = conf.OSSBucketDestination.RoleArn.replace(/.*\//, '');
        delete conf.OSSBucketDestination.RoleArn;
        // OSSBucketDestination.bucket
        conf.OSSBucketDestination.bucket = conf.OSSBucketDestination.Bucket.replace(/.*:::/, '');
        delete conf.OSSBucketDestination.Bucket;
        delete conf.Destination;
        // frequency
        conf.frequency = conf.Schedule.Frequency;
        delete conf.Schedule.Frequency;
        // optionalFields
        if (((_a = conf === null || conf === void 0 ? void 0 : conf.OptionalFields) === null || _a === void 0 ? void 0 : _a.Field) && !isArray_1.isArray((_b = conf.OptionalFields) === null || _b === void 0 ? void 0 : _b.Field))
            conf.OptionalFields.Field = [conf.OptionalFields.Field];
    });
    // firstLowerCase
    _ = formatObjKey_1.formatObjKey(_, 'firstLowerCase', { exclude: ['OSSBucketDestination', 'SSE-OSS', 'SSE-KMS'] });
    return _;
}

}, function(modId) { var map = {"../utils/dataFix":1745133307319,"../utils/isObject":1745133307240,"../utils/isArray":1745133307270,"../utils/formatObjKey":1745133307252}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307319, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.dataFix = void 0;
const isObject_1 = require("./isObject");
const TRUE = ['true', 'TRUE', '1', 1];
const FALSE = ['false', 'FALSE', '0', 0];
function dataFix(o, conf, finalKill) {
    if (!isObject_1.isObject(o))
        return;
    const { remove = [], rename = {}, camel = [], bool = [], lowerFirst = false } = conf;
    // 删除不需要的数据
    remove.forEach(v => delete o[v]);
    // 重命名
    Object.entries(rename).forEach(v => {
        if (!o[v[0]])
            return;
        if (o[v[1]])
            return;
        o[v[1]] = o[v[0]];
        delete o[v[0]];
    });
    // 驼峰化
    camel.forEach(v => {
        if (!o[v])
            return;
        const afterKey = v.replace(/^(.)/, $0 => $0.toLowerCase()).replace(/-(\w)/g, (_, $1) => $1.toUpperCase());
        if (o[afterKey])
            return;
        o[afterKey] = o[v];
        // todo 暂时兼容以前数据，不做删除
        // delete o[v];
    });
    // 转换值为布尔值
    bool.forEach(v => {
        o[v] = fixBool(o[v]);
    });
    // finalKill
    if (typeof finalKill === 'function') {
        finalKill(o);
    }
    // 首字母转小写
    fixLowerFirst(o, lowerFirst);
    return dataFix;
}
exports.dataFix = dataFix;
function fixBool(value) {
    if (!value)
        return false;
    if (TRUE.includes(value))
        return true;
    return FALSE.includes(value) ? false : value;
}
function fixLowerFirst(o, lowerFirst) {
    if (lowerFirst) {
        Object.keys(o).forEach(key => {
            const lowerK = key.replace(/^\w/, match => match.toLowerCase());
            if (typeof o[lowerK] === 'undefined') {
                o[lowerK] = o[key];
                delete o[key];
            }
        });
    }
}

}, function(modId) { var map = {"./isObject":1745133307240}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307320, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBucketInventory = void 0;
const checkBucketName_1 = require("../utils/checkBucketName");
/**
 * deleteBucketInventory
 * @param {String} bucketName - bucket name
 * @param {String} inventoryId
 * @param {Object} options
 */
async function deleteBucketInventory(bucketName, inventoryId, options = {}) {
    const subres = Object.assign({ inventory: '', inventoryId }, options.subres);
    checkBucketName_1.checkBucketName(bucketName);
    const params = this._bucketRequestParams('DELETE', bucketName, subres, options);
    params.successStatuses = [204];
    const result = await this.request(params);
    return {
        status: result.status,
        res: result.res
    };
}
exports.deleteBucketInventory = deleteBucketInventory;

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307321, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.listBucketInventory = void 0;
const checkBucketName_1 = require("../utils/checkBucketName");
const formatInventoryConfig_1 = require("../utils/formatInventoryConfig");
/**
 * listBucketInventory
 * @param {String} bucketName - bucket name
 * @param {String} inventoryId
 * @param {Object} options
 */
async function listBucketInventory(bucketName, options = {}) {
    const { continuationToken } = options;
    const subres = Object.assign({ inventory: '' }, continuationToken && { 'continuation-token': continuationToken }, options.subres);
    checkBucketName_1.checkBucketName(bucketName);
    const params = this._bucketRequestParams('GET', bucketName, subres, options);
    params.successStatuses = [200];
    params.xmlResponse = true;
    const result = await this.request(params);
    const { data, res, status } = result;
    return {
        isTruncated: data.IsTruncated === 'true',
        nextContinuationToken: data.NextContinuationToken,
        inventoryList: formatInventoryConfig_1.formatInventoryConfig(data.InventoryConfiguration, true),
        status,
        res
    };
}
exports.listBucketInventory = listBucketInventory;

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/formatInventoryConfig":1745133307318}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307322, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.putBucketInventory = void 0;
const checkBucketName_1 = require("../utils/checkBucketName");
const obj2xml_1 = require("../utils/obj2xml");
/**
 * putBucketInventory
 * @param {String} bucketName - bucket name
 * @param {Inventory} inventory
 * @param {Object} options
 */
async function putBucketInventory(bucketName, inventory, options = {}) {
    const subres = Object.assign({ inventory: '', inventoryId: inventory.id }, options.subres);
    checkBucketName_1.checkBucketName(bucketName);
    const { OSSBucketDestination, optionalFields, includedObjectVersions } = inventory;
    const destinationBucketPrefix = 'acs:oss:::';
    const rolePrefix = `acs:ram::${OSSBucketDestination.accountId}:role/`;
    const paramXMLObj = {
        InventoryConfiguration: {
            Id: inventory.id,
            IsEnabled: inventory.isEnabled,
            Filter: {
                Prefix: inventory.prefix || ''
            },
            Destination: {
                OSSBucketDestination: {
                    Format: OSSBucketDestination.format,
                    AccountId: OSSBucketDestination.accountId,
                    RoleArn: `${rolePrefix}${OSSBucketDestination.rolename}`,
                    Bucket: `${destinationBucketPrefix}${OSSBucketDestination.bucket}`,
                    Prefix: OSSBucketDestination.prefix || '',
                    Encryption: OSSBucketDestination.encryption || ''
                }
            },
            Schedule: {
                Frequency: inventory.frequency
            },
            IncludedObjectVersions: includedObjectVersions,
            OptionalFields: {
                Field: (optionalFields === null || optionalFields === void 0 ? void 0 : optionalFields.field) || []
            }
        }
    };
    const paramXML = obj2xml_1.obj2xml(paramXMLObj, {
        headers: true,
        firstUpperCase: true
    });
    const params = this._bucketRequestParams('PUT', bucketName, subres, options);
    params.successStatuses = [200];
    params.mime = 'xml';
    params.content = paramXML;
    const result = await this.request(params);
    return {
        status: result.status,
        res: result.res
    };
}
exports.putBucketInventory = putBucketInventory;

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/obj2xml":1745133307265}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307323, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.abortBucketWorm = void 0;
const checkBucketName_1 = require("../utils/checkBucketName");
async function abortBucketWorm(name, options) {
    checkBucketName_1.checkBucketName(name);
    const params = this._bucketRequestParams('DELETE', name, 'worm', options);
    const result = await this.request(params);
    return {
        res: result.res,
        status: result.status
    };
}
exports.abortBucketWorm = abortBucketWorm;

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307324, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.completeBucketWorm = void 0;
const checkBucketName_1 = require("../utils/checkBucketName");
async function completeBucketWorm(name, wormId, options) {
    checkBucketName_1.checkBucketName(name);
    const params = this._bucketRequestParams('POST', name, { wormId }, options);
    const result = await this.request(params);
    return {
        res: result.res,
        status: result.status
    };
}
exports.completeBucketWorm = completeBucketWorm;

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307325, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.extendBucketWorm = void 0;
const checkBucketName_1 = require("../utils/checkBucketName");
const obj2xml_1 = require("../utils/obj2xml");
async function extendBucketWorm(name, wormId, days, options) {
    checkBucketName_1.checkBucketName(name);
    const params = this._bucketRequestParams('POST', name, { wormExtend: '', wormId }, options);
    const paramlXMLObJ = {
        ExtendWormConfiguration: {
            RetentionPeriodInDays: days
        }
    };
    params.mime = 'xml';
    params.content = obj2xml_1.obj2xml(paramlXMLObJ, { headers: true });
    params.successStatuses = [200];
    const result = await this.request(params);
    return {
        res: result.res,
        status: result.status
    };
}
exports.extendBucketWorm = extendBucketWorm;

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/obj2xml":1745133307265}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307326, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.getBucketWorm = void 0;
const checkBucketName_1 = require("../utils/checkBucketName");
const dataFix_1 = require("../utils/dataFix");
async function getBucketWorm(name, options) {
    checkBucketName_1.checkBucketName(name);
    const params = this._bucketRequestParams('GET', name, 'worm', options);
    params.successStatuses = [200];
    params.xmlResponse = true;
    const result = await this.request(params);
    dataFix_1.dataFix(result.data, {
        lowerFirst: true,
        rename: {
            RetentionPeriodInDays: 'days'
        }
    });
    return Object.assign(Object.assign({}, result.data), { res: result.res, status: result.status });
}
exports.getBucketWorm = getBucketWorm;

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243,"../utils/dataFix":1745133307319}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307327, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateBucketWorm = void 0;
const obj2xml_1 = require("../utils/obj2xml");
const checkBucketName_1 = require("../utils/checkBucketName");
async function initiateBucketWorm(name, days, options) {
    checkBucketName_1.checkBucketName(name);
    const params = this._bucketRequestParams('POST', name, 'worm', options);
    const paramlXMLObJ = {
        InitiateWormConfiguration: {
            RetentionPeriodInDays: days
        }
    };
    params.mime = 'xml';
    params.content = obj2xml_1.obj2xml(paramlXMLObJ, { headers: true });
    params.successStatuses = [200];
    const result = await this.request(params);
    return {
        res: result.res,
        wormId: result.res.headers['x-oss-worm-id'],
        status: result.status
    };
}
exports.initiateBucketWorm = initiateBucketWorm;

}, function(modId) { var map = {"../utils/obj2xml":1745133307265,"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307328, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.getBucketStat = void 0;
const checkBucketName_1 = require("../utils/checkBucketName");
async function getBucketStat(name, options) {
    name = name || this.options.bucket;
    checkBucketName_1.checkBucketName(name);
    const params = this._bucketRequestParams('GET', name, 'stat', options);
    params.successStatuses = [200];
    params.xmlResponse = true;
    const result = await this.request(params);
    return {
        res: result.res,
        stat: result.data
    };
}
exports.getBucketStat = getBucketStat;

}, function(modId) { var map = {"../utils/checkBucketName":1745133307243}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307329, function(require, module, exports) {
const assert = require('assert');
const { isArray } = require('./common/utils/isArray');
const { checkBucketName: _checkBucketName } = require('../lib/common/utils/checkBucketName');
const { formatTag } = require('../lib/common/utils/formatTag');

const proto = exports;

function toArray(obj) {
  if (!obj) return [];
  if (isArray(obj)) return obj;
  return [obj];
}

/**
 * Bucket opertaions
 */

proto.listBuckets = async function listBuckets(query = {}, options = {}) {
  // prefix, marker, max-keys

  const { subres = {} } = query;
  const rest = {};
  for (const key in query) {
    if (key !== 'subres') {
      rest[key] = query[key];
    }
  }
  const params = this._bucketRequestParams('GET', '', Object.assign(subres, options.subres), options);

  params.query = rest;

  const result = await this.request(params);

  if (result.status === 200) {
    const data = await this.parseXML(result.data);
    let buckets = data.Buckets || null;
    if (buckets) {
      if (buckets.Bucket) {
        buckets = buckets.Bucket;
      }
      if (!isArray(buckets)) {
        buckets = [buckets];
      }
      buckets = buckets.map(item => ({
        name: item.Name,
        region: item.Location,
        creationDate: item.CreationDate,
        storageClass: item.StorageClass,
        StorageClass: item.StorageClass,
        tag: formatTag(item)
      }));
    }
    return {
      buckets,
      owner: {
        id: data.Owner.ID,
        displayName: data.Owner.DisplayName
      },
      isTruncated: data.IsTruncated === 'true',
      nextMarker: data.NextMarker || null,
      res: result.res
    };
  }

  throw await this.requestError(result);
};

proto.useBucket = function useBucket(name) {
  _checkBucketName(name);
  return this.setBucket(name);
};

proto.setBucket = function useBucket(name) {
  _checkBucketName(name);
  this.options.bucket = name;
  return this;
};

proto.getBucket = function getBucket() {
  return this.options.bucket;
};

proto.getBucketLocation = async function getBucketLocation(name, options) {
  _checkBucketName(name);
  name = name || this.getBucket();
  const params = this._bucketRequestParams('GET', name, 'location', options);
  params.successStatuses = [200];
  params.xmlResponse = true;
  const result = await this.request(params);
  return {
    location: result.data,
    res: result.res
  };
};

proto.getBucketInfo = async function getBucketInfo(name, options) {
  _checkBucketName(name);
  name = name || this.getBucket();
  const params = this._bucketRequestParams('GET', name, 'bucketInfo', options);
  params.successStatuses = [200];
  params.xmlResponse = true;
  const result = await this.request(params);
  return {
    bucket: result.data.Bucket,
    res: result.res
  };
};

proto.deleteBucket = async function deleteBucket(name, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('DELETE', name, '', options);
  const result = await this.request(params);
  if (result.status === 200 || result.status === 204) {
    return {
      res: result.res
    };
  }
  throw await this.requestError(result);
};

// acl

proto.putBucketACL = async function putBucketACL(name, acl, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('PUT', name, 'acl', options);
  params.headers = {
    'x-oss-acl': acl
  };
  params.successStatuses = [200];
  const result = await this.request(params);
  return {
    bucket: (result.headers.location && result.headers.location.substring(1)) || null,
    res: result.res
  };
};

proto.getBucketACL = async function getBucketACL(name, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('GET', name, 'acl', options);
  params.successStatuses = [200];
  params.xmlResponse = true;
  const result = await this.request(params);
  return {
    acl: result.data.AccessControlList.Grant,
    owner: {
      id: result.data.Owner.ID,
      displayName: result.data.Owner.DisplayName
    },
    res: result.res
  };
};

// logging

proto.putBucketLogging = async function putBucketLogging(name, prefix, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('PUT', name, 'logging', options);
  let xml = `${'<?xml version="1.0" encoding="UTF-8"?>\n<BucketLoggingStatus>\n<LoggingEnabled>\n<TargetBucket>'}${name}</TargetBucket>\n`;
  if (prefix) {
    xml += `<TargetPrefix>${prefix}</TargetPrefix>\n`;
  }
  xml += '</LoggingEnabled>\n</BucketLoggingStatus>';
  params.content = xml;
  params.mime = 'xml';
  params.successStatuses = [200];
  const result = await this.request(params);
  return {
    res: result.res
  };
};

proto.getBucketLogging = async function getBucketLogging(name, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('GET', name, 'logging', options);
  params.successStatuses = [200];
  params.xmlResponse = true;
  const result = await this.request(params);
  const enable = result.data.LoggingEnabled;
  return {
    enable: !!enable,
    prefix: (enable && enable.TargetPrefix) || null,
    res: result.res
  };
};

proto.deleteBucketLogging = async function deleteBucketLogging(name, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('DELETE', name, 'logging', options);
  params.successStatuses = [204, 200];
  const result = await this.request(params);
  return {
    res: result.res
  };
};

proto.putBucketCORS = async function putBucketCORS(name, rules, options) {
  _checkBucketName(name);
  rules = rules || [];
  assert(rules.length, 'rules is required');
  rules.forEach(rule => {
    assert(rule.allowedOrigin, 'allowedOrigin is required');
    assert(rule.allowedMethod, 'allowedMethod is required');
  });

  const params = this._bucketRequestParams('PUT', name, 'cors', options);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<CORSConfiguration>';
  const parseOrigin = val => {
    xml += `<AllowedOrigin>${val}</AllowedOrigin>`;
  };
  const parseMethod = val => {
    xml += `<AllowedMethod>${val}</AllowedMethod>`;
  };
  const parseHeader = val => {
    xml += `<AllowedHeader>${val}</AllowedHeader>`;
  };
  const parseExposeHeader = val => {
    xml += `<ExposeHeader>${val}</ExposeHeader>`;
  };
  for (let i = 0, l = rules.length; i < l; i++) {
    const rule = rules[i];
    xml += '<CORSRule>';

    toArray(rule.allowedOrigin).forEach(parseOrigin);
    toArray(rule.allowedMethod).forEach(parseMethod);
    toArray(rule.allowedHeader).forEach(parseHeader);
    toArray(rule.exposeHeader).forEach(parseExposeHeader);
    if (rule.maxAgeSeconds) {
      xml += `<MaxAgeSeconds>${rule.maxAgeSeconds}</MaxAgeSeconds>`;
    }
    xml += '</CORSRule>';
  }
  xml += '</CORSConfiguration>';
  params.content = xml;
  params.mime = 'xml';
  params.successStatuses = [200];
  const result = await this.request(params);
  return {
    res: result.res
  };
};

proto.getBucketCORS = async function getBucketCORS(name, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('GET', name, 'cors', options);
  params.successStatuses = [200];
  params.xmlResponse = true;
  const result = await this.request(params);
  const rules = [];
  if (result.data && result.data.CORSRule) {
    let { CORSRule } = result.data;
    if (!isArray(CORSRule)) CORSRule = [CORSRule];
    CORSRule.forEach(rule => {
      const r = {};
      Object.keys(rule).forEach(key => {
        r[key.slice(0, 1).toLowerCase() + key.slice(1, key.length)] = rule[key];
      });
      rules.push(r);
    });
  }
  return {
    rules,
    res: result.res
  };
};

proto.deleteBucketCORS = async function deleteBucketCORS(name, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('DELETE', name, 'cors', options);
  params.successStatuses = [204];
  const result = await this.request(params);
  return {
    res: result.res
  };
};

// referer

proto.putBucketReferer = async function putBucketReferer(name, allowEmpty, referers, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('PUT', name, 'referer', options);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<RefererConfiguration>\n';
  xml += `  <AllowEmptyReferer>${allowEmpty ? 'true' : 'false'}</AllowEmptyReferer>\n`;
  if (referers && referers.length > 0) {
    xml += '  <RefererList>\n';
    for (let i = 0; i < referers.length; i++) {
      xml += `    <Referer>${referers[i]}</Referer>\n`;
    }
    xml += '  </RefererList>\n';
  } else {
    xml += '  <RefererList />\n';
  }
  xml += '</RefererConfiguration>';
  params.content = xml;
  params.mime = 'xml';
  params.successStatuses = [200];
  const result = await this.request(params);
  return {
    res: result.res
  };
};

proto.getBucketReferer = async function getBucketReferer(name, options) {
  _checkBucketName(name);
  const params = this._bucketRequestParams('GET', name, 'referer', options);
  params.successStatuses = [200];
  params.xmlResponse = true;
  const result = await this.request(params);
  let referers = result.data.RefererList.Referer || null;
  if (referers) {
    if (!isArray(referers)) {
      referers = [referers];
    }
  }
  return {
    allowEmpty: result.data.AllowEmptyReferer === 'true',
    referers,
    res: result.res
  };
};

proto.deleteBucketReferer = async function deleteBucketReferer(name, options) {
  _checkBucketName(name);
  return await this.putBucketReferer(name, true, null, options);
};

// private apis

proto._bucketRequestParams = function _bucketRequestParams(method, bucket, subres, options) {
  return {
    method,
    bucket,
    subres,
    headers: options && options.headers,
    additionalHeaders: options && options.additionalHeaders,
    timeout: options && options.timeout,
    ctx: options && options.ctx
  };
};

}, function(modId) { var map = {"./common/utils/isArray":1745133307270,"../lib/common/utils/checkBucketName":1745133307243,"../lib/common/utils/formatTag":1745133307299}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307330, function(require, module, exports) {
const fs = require('fs');
const is = require('is-type-of');
const util = require('util');
const path = require('path');
const mime = require('mime');
const { isFile } = require('./common/utils/isFile');
const { isArray } = require('./common/utils/isArray');
const { isBuffer } = require('./common/utils/isBuffer');
const { retry } = require('./common/utils/retry');

const proto = exports;

/**
 * Multipart operations
 */

/**
 * Upload a file to OSS using multipart uploads
 * @param {String} name
 * @param {String|File|Buffer} file
 * @param {Object} options
 *        {Object} [options.callback] The callback parameter is composed of a JSON string encoded in Base64
 *        {String} options.callback.url the OSS sends a callback request to this URL
 *        {String} [options.callback.host] The host header value for initiating callback requests
 *        {String} options.callback.body The value of the request body when a callback is initiated
 *        {String} [options.callback.contentType] The Content-Type of the callback requests initiated
 *        {Boolean} [options.callback.callbackSNI] Whether OSS sends SNI to the origin address specified by callbackUrl when a callback request is initiated from the client
 *        {Object} [options.callback.customValue] Custom parameters are a map of key-values, e.g:
 *                  customValue = {
 *                    key1: 'value1',
 *                    key2: 'value2'
 *                  }
 */
proto.multipartUpload = async function multipartUpload(name, file, options) {
  this.resetCancelFlag();
  options = options || {};
  if (options.checkpoint && options.checkpoint.uploadId) {
    return await this._resumeMultipart(options.checkpoint, options);
  }

  const minPartSize = 100 * 1024;
  if (!options.mime) {
    if (isFile(file)) {
      options.mime = mime.getType(path.extname(file.name));
    } else if (isBuffer(file)) {
      options.mime = '';
    } else {
      options.mime = mime.getType(path.extname(file));
    }
  }
  options.headers = options.headers || {};
  this._convertMetaToHeaders(options.meta, options.headers);

  const fileSize = await this._getFileSize(file);
  if (fileSize < minPartSize) {
    options.contentLength = fileSize;
    const result = await this.put(name, file, options);
    if (options && options.progress) {
      await options.progress(1);
    }

    const ret = {
      res: result.res,
      bucket: this.options.bucket,
      name,
      etag: result.res.headers.etag
    };

    if ((options.headers && options.headers['x-oss-callback']) || options.callback) {
      ret.data = result.data;
    }

    return ret;
  }

  if (options.partSize && !(parseInt(options.partSize, 10) === options.partSize)) {
    throw new Error('partSize must be int number');
  }

  if (options.partSize && options.partSize < minPartSize) {
    throw new Error(`partSize must not be smaller than ${minPartSize}`);
  }

  const initResult = await this.initMultipartUpload(name, options);
  const { uploadId } = initResult;
  const partSize = this._getPartSize(fileSize, options.partSize);

  const checkpoint = {
    file,
    name,
    fileSize,
    partSize,
    uploadId,
    doneParts: []
  };

  if (options && options.progress) {
    await options.progress(0, checkpoint, initResult.res);
  }

  return await this._resumeMultipart(checkpoint, options);
};

/*
 * Resume multipart upload from checkpoint. The checkpoint will be
 * updated after each successful part upload.
 * @param {Object} checkpoint the checkpoint
 * @param {Object} options
 */
proto._resumeMultipart = async function _resumeMultipart(checkpoint, options) {
  const that = this;
  if (this.isCancel()) {
    throw this._makeCancelEvent();
  }
  const { file, fileSize, partSize, uploadId, doneParts, name } = checkpoint;

  const partOffs = this._divideParts(fileSize, partSize);
  const numParts = partOffs.length;
  let uploadPartJob = retry(
    (self, partNo) => {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve, reject) => {
        try {
          if (!self.isCancel()) {
            const pi = partOffs[partNo - 1];
            const stream = await self._createStream(file, pi.start, pi.end);
            const data = {
              stream,
              size: pi.end - pi.start
            };

            if (isArray(self.multipartUploadStreams)) {
              self.multipartUploadStreams.push(data.stream);
            } else {
              self.multipartUploadStreams = [data.stream];
            }

            const removeStreamFromMultipartUploadStreams = function () {
              if (!stream.destroyed) {
                stream.destroy();
              }
              const index = self.multipartUploadStreams.indexOf(stream);
              if (index !== -1) {
                self.multipartUploadStreams.splice(index, 1);
              }
            };

            stream.on('close', removeStreamFromMultipartUploadStreams);
            stream.on('error', removeStreamFromMultipartUploadStreams);

            let result;
            try {
              result = await self._uploadPart(name, uploadId, partNo, data, options);
            } catch (error) {
              removeStreamFromMultipartUploadStreams();
              if (error.status === 404) {
                throw self._makeAbortEvent();
              }
              throw error;
            }
            if (!self.isCancel()) {
              doneParts.push({
                number: partNo,
                etag: result.res.headers.etag
              });
              checkpoint.doneParts = doneParts;

              if (options.progress) {
                await options.progress(doneParts.length / (numParts + 1), checkpoint, result.res);
              }
            }
          }
          resolve();
        } catch (err) {
          err.partNum = partNo;
          reject(err);
        }
      });
    },
    this.options.retryMax,
    {
      errorHandler: err => {
        const _errHandle = _err => {
          const statusErr = [-1, -2].includes(_err.status);
          const requestErrorRetryHandle = this.options.requestErrorRetryHandle || (() => true);
          return statusErr && requestErrorRetryHandle(_err);
        };
        return !!_errHandle(err);
      }
    }
  );

  const all = Array.from(new Array(numParts), (x, i) => i + 1);
  const done = doneParts.map(p => p.number);
  const todo = all.filter(p => done.indexOf(p) < 0);

  const defaultParallel = 5;
  const parallel = options.parallel || defaultParallel;

  if (this.checkBrowserAndVersion('Internet Explorer', '10') || parallel === 1) {
    for (let i = 0; i < todo.length; i++) {
      if (this.isCancel()) {
        throw this._makeCancelEvent();
      }
      /* eslint no-await-in-loop: [0] */
      await uploadPartJob(this, todo[i]);
    }
  } else {
    // upload in parallel
    const jobErr = await this._parallel(todo, parallel, value => {
      return new Promise((resolve, reject) => {
        uploadPartJob(that, value)
          .then(() => {
            resolve();
          })
          .catch(reject);
      });
    });

    const abortEvent = jobErr.find(err => err.name === 'abort');
    if (abortEvent) throw abortEvent;

    if (this.isCancel()) {
      uploadPartJob = null;
      throw this._makeCancelEvent();
    }

    if (jobErr && jobErr.length > 0) {
      jobErr[0].message = `Failed to upload some parts with error: ${jobErr[0].toString()} part_num: ${
        jobErr[0].partNum
      }`;
      throw jobErr[0];
    }
  }

  return await this.completeMultipartUpload(name, uploadId, doneParts, options);
};

/**
 * Get file size
 */
proto._getFileSize = async function _getFileSize(file) {
  if (isBuffer(file)) {
    return file.length;
  } else if (isFile(file)) {
    return file.size;
  } else if (is.string(file)) {
    const stat = await this._statFile(file);
    return stat.size;
  }

  throw new Error('_getFileSize requires Buffer/File/String.');
};

/*
 * Readable stream for Web File
 */
const { Readable } = require('stream');

function WebFileReadStream(file, options) {
  if (!(this instanceof WebFileReadStream)) {
    return new WebFileReadStream(file, options);
  }

  Readable.call(this, options);

  this.file = file;
  this.reader = new FileReader();
  this.start = 0;
  this.finish = false;
  this.fileBuffer = null;
}
util.inherits(WebFileReadStream, Readable);

WebFileReadStream.prototype.readFileAndPush = function readFileAndPush(size) {
  if (this.fileBuffer) {
    let pushRet = true;
    while (pushRet && this.fileBuffer && this.start < this.fileBuffer.length) {
      const { start } = this;
      let end = start + size;
      end = end > this.fileBuffer.length ? this.fileBuffer.length : end;
      this.start = end;
      pushRet = this.push(this.fileBuffer.slice(start, end));
    }
  }
};

WebFileReadStream.prototype._read = function _read(size) {
  if (
    (this.file && this.start >= this.file.size) ||
    (this.fileBuffer && this.start >= this.fileBuffer.length) ||
    this.finish ||
    (this.start === 0 && !this.file)
  ) {
    if (!this.finish) {
      this.fileBuffer = null;
      this.finish = true;
    }
    this.push(null);
    return;
  }

  const defaultReadSize = 16 * 1024;
  size = size || defaultReadSize;

  const that = this;
  this.reader.onload = function (e) {
    that.fileBuffer = Buffer.from(new Uint8Array(e.target.result));
    that.file = null;
    that.readFileAndPush(size);
  };
  this.reader.onerror = function onload(e) {
    const error = e.srcElement && e.srcElement.error;
    if (error) {
      throw error;
    }
    throw e;
  };

  if (this.start === 0) {
    this.reader.readAsArrayBuffer(this.file);
  } else {
    this.readFileAndPush(size);
  }
};

proto._createStream = function _createStream(file, start, end) {
  if (is.readableStream(file)) {
    return file;
  } else if (isFile(file)) {
    return new WebFileReadStream(file.slice(start, end));
  } else if (isBuffer(file)) {
    const iterable = file.subarray(start, end);
    // we can't use Readable.from() since it is only support in Node v10
    return new Readable({
      read() {
        this.push(iterable);
        this.push(null);
      }
    });
  } else if (is.string(file)) {
    return fs.createReadStream(file, {
      start,
      end: end - 1
    });
  }
  throw new Error('_createStream requires Buffer/File/String.');
};

proto._getPartSize = function _getPartSize(fileSize, partSize) {
  const maxNumParts = 10 * 1000;
  const defaultPartSize = 1 * 1024 * 1024;

  if (!partSize) partSize = defaultPartSize;
  const safeSize = Math.ceil(fileSize / maxNumParts);

  if (partSize < safeSize) {
    partSize = safeSize;
    console.warn(
      `partSize has been set to ${partSize}, because the partSize you provided causes partNumber to be greater than 10,000`
    );
  }
  return partSize;
};

proto._divideParts = function _divideParts(fileSize, partSize) {
  const numParts = Math.ceil(fileSize / partSize);

  const partOffs = [];
  for (let i = 0; i < numParts; i++) {
    const start = partSize * i;
    const end = Math.min(start + partSize, fileSize);

    partOffs.push({
      start,
      end
    });
  }

  return partOffs;
};

}, function(modId) { var map = {"./common/utils/isFile":1745133307331,"./common/utils/isArray":1745133307270,"./common/utils/isBuffer":1745133307289,"./common/utils/retry":1745133307253}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307331, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.isFile = void 0;
exports.isFile = obj => {
    return typeof File !== 'undefined' && obj instanceof File;
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307332, function(require, module, exports) {
/**
 * Copyright(c) ali-sdk and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   rockuw <rockuw@gmail.com> (http://rockuw.com)
 */

/**
 * Module dependencies.
 */

const jstoxml = require('jstoxml');
const utility = require('utility');
const copy = require('copy-to');
const urlutil = require('url');

const proto = exports;

/**
 * RTMP operations
 */

/**
 * Create a live channel
 * @param {String} id the channel id
 * @param {Object} conf the channel configuration
 * @param {Object} options
 * @return {Object}
 */
proto.putChannel = async function putChannel(id, conf, options) {
  options = options || {};
  options.subres = 'live';

  const params = this._objectRequestParams('PUT', id, options);
  params.xmlResponse = true;
  params.content = jstoxml.toXML({
    LiveChannelConfiguration: conf
  });
  params.successStatuses = [200];

  const result = await this.request(params);

  let publishUrls = result.data.PublishUrls.Url;
  if (!Array.isArray(publishUrls)) {
    publishUrls = [publishUrls];
  }
  let playUrls = result.data.PlayUrls.Url;
  if (!Array.isArray(playUrls)) {
    playUrls = [playUrls];
  }

  return {
    publishUrls,
    playUrls,
    res: result.res
  };
};

/**
 * Get the channel info
 * @param {String} id the channel id
 * @param {Object} options
 * @return {Object}
 */
proto.getChannel = async function getChannel(id, options) {
  options = options || {};
  options.subres = 'live';

  const params = this._objectRequestParams('GET', id, options);
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    data: result.data,
    res: result.res
  };
};

/**
 * Delete the channel
 * @param {String} id the channel id
 * @param {Object} options
 * @return {Object}
 */
proto.deleteChannel = async function deleteChannel(id, options) {
  options = options || {};
  options.subres = 'live';

  const params = this._objectRequestParams('DELETE', id, options);
  params.successStatuses = [204];

  const result = await this.request(params);

  return {
    res: result.res
  };
};

/**
 * Set the channel status
 * @param {String} id the channel id
 * @param {String} status the channel status
 * @param {Object} options
 * @return {Object}
 */
proto.putChannelStatus = async function putChannelStatus(id, status, options) {
  options = options || {};
  options.subres = {
    live: null,
    status
  };

  const params = this._objectRequestParams('PUT', id, options);
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    res: result.res
  };
};

/**
 * Get the channel status
 * @param {String} id the channel id
 * @param {Object} options
 * @return {Object}
 */
proto.getChannelStatus = async function getChannelStatus(id, options) {
  options = options || {};
  options.subres = {
    live: null,
    comp: 'stat'
  };

  const params = this._objectRequestParams('GET', id, options);
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    data: result.data,
    res: result.res
  };
};

/**
 * List the channels
 * @param {Object} query the query parameters
 *  filter options:
 *   - prefix {String}: the channel id prefix (returns channels with this prefix)
 *   - marker {String}: the channle id marker (returns channels after this id)
 *   - max-keys {Number}: max number of channels to return
 * @param {Object} options
 * @return {Object}
 */
proto.listChannels = async function listChannels(query, options) {
  // prefix, marker, max-keys

  options = options || {};
  options.subres = 'live';

  const params = this._objectRequestParams('GET', '', options);
  params.query = query;
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);

  let channels = result.data.LiveChannel || [];
  if (!Array.isArray(channels)) {
    channels = [channels];
  }

  channels = channels.map(x => {
    x.PublishUrls = x.PublishUrls.Url;
    if (!Array.isArray(x.PublishUrls)) {
      x.PublishUrls = [x.PublishUrls];
    }
    x.PlayUrls = x.PlayUrls.Url;
    if (!Array.isArray(x.PlayUrls)) {
      x.PlayUrls = [x.PlayUrls];
    }

    return x;
  });

  return {
    channels,
    nextMarker: result.data.NextMarker || null,
    isTruncated: result.data.IsTruncated === 'true',
    res: result.res
  };
};

/**
 * Get the channel history
 * @param {String} id the channel id
 * @param {Object} options
 * @return {Object}
 */
proto.getChannelHistory = async function getChannelHistory(id, options) {
  options = options || {};
  options.subres = {
    live: null,
    comp: 'history'
  };

  const params = this._objectRequestParams('GET', id, options);
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);

  let records = result.data.LiveRecord || [];
  if (!Array.isArray(records)) {
    records = [records];
  }
  return {
    records,
    res: result.res
  };
};

/**
 * Create vod playlist
 * @param {String} id the channel id
 * @param {String} name the playlist name
 * @param {Object} time the begin and end time
 *  time:
 *   - startTime {Number}: the begin time in epoch seconds
 *   - endTime {Number}: the end time in epoch seconds
 * @param {Object} options
 * @return {Object}
 */
proto.createVod = async function createVod(id, name, time, options) {
  options = options || {};
  options.subres = {
    vod: null
  };
  copy(time).to(options.subres);

  const params = this._objectRequestParams('POST', `${id}/${name}`, options);
  params.query = time;
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    res: result.res
  };
};

/**
 * Get RTMP Url
 * @param {String} channelId the channel id
 * @param {Object} options
 *  options:
 *   - expires {Number}: expire time in seconds
 *   - params {Object}: the parameters such as 'playlistName'
 * @return {String} the RTMP url
 */
proto.getRtmpUrl = function (channelId, options) {
  options = options || {};
  const expires = utility.timestamp() + (options.expires || 1800);
  const res = {
    bucket: this.options.bucket,
    object: this._objectName(`live/${channelId}`)
  };
  const resource = `/${res.bucket}/${channelId}`;

  options.params = options.params || {};
  const query = Object.keys(options.params)
    .sort()
    .map(x => `${x}:${options.params[x]}\n`)
    .join('');

  const stringToSign = `${expires}\n${query}${resource}`;
  const signature = this.signature(stringToSign);

  const url = urlutil.parse(this._getReqUrl(res));
  url.protocol = 'rtmp:';
  url.query = {
    OSSAccessKeyId: this.options.accessKeyId,
    Expires: expires,
    Signature: signature
  };
  copy(options.params).to(url.query);

  return url.format();
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307333, function(require, module, exports) {
/* eslint-disable no-async-promise-executor */

const debug = require('debug')('ali-oss:multipart-copy');
const copy = require('copy-to');

const proto = exports;

/**
 * Upload a part copy in a multipart from the source bucket/object
 * used with initMultipartUpload and completeMultipartUpload.
 * @param {String} name copy object name
 * @param {String} uploadId the upload id
 * @param {Number} partNo the part number
 * @param {String} range  like 0-102400  part size need to copy
 * @param {Object} sourceData
 *        {String} sourceData.sourceKey  the source object name
 *        {String} sourceData.sourceBucketName  the source bucket name
 * @param {Object} options
 */
/* eslint max-len: [0] */
proto.uploadPartCopy = async function uploadPartCopy(name, uploadId, partNo, range, sourceData, options = {}) {
  options.headers = options.headers || {};
  const versionId = options.versionId || (options.subres && options.subres.versionId) || null;
  let copySource;
  if (versionId) {
    copySource = `/${sourceData.sourceBucketName}/${encodeURIComponent(sourceData.sourceKey)}?versionId=${versionId}`;
  } else {
    copySource = `/${sourceData.sourceBucketName}/${encodeURIComponent(sourceData.sourceKey)}`;
  }

  options.headers['x-oss-copy-source'] = copySource;
  if (range) {
    options.headers['x-oss-copy-source-range'] = `bytes=${range}`;
  }

  options.subres = {
    partNumber: partNo,
    uploadId
  };
  const params = this._objectRequestParams('PUT', name, options);
  params.mime = options.mime;
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    name,
    etag: result.res.headers.etag,
    res: result.res
  };
};

/**
 * @param {String} name copy object name
 * @param {Object} sourceData
 *        {String} sourceData.sourceKey  the source object name
 *        {String} sourceData.sourceBucketName  the source bucket name
 *        {Number} sourceData.startOffset  data copy start byte offset, e.g: 0
 *        {Number} sourceData.endOffset  data copy end byte offset, e.g: 102400
 * @param {Object} options
 *        {Number} options.partSize
 */
proto.multipartUploadCopy = async function multipartUploadCopy(name, sourceData, options = {}) {
  this.resetCancelFlag();
  const { versionId = null } = options;
  const metaOpt = {
    versionId
  };
  const objectMeta = await this._getObjectMeta(sourceData.sourceBucketName, sourceData.sourceKey, metaOpt);
  const fileSize = objectMeta.res.headers['content-length'];
  sourceData.startOffset = sourceData.startOffset || 0;
  sourceData.endOffset = sourceData.endOffset || fileSize;

  if (options.checkpoint && options.checkpoint.uploadId) {
    return await this._resumeMultipartCopy(options.checkpoint, sourceData, options);
  }

  const minPartSize = 100 * 1024;

  const copySize = sourceData.endOffset - sourceData.startOffset;
  if (copySize < minPartSize) {
    throw new Error(`copySize must not be smaller than ${minPartSize}`);
  }

  if (options.partSize && options.partSize < minPartSize) {
    throw new Error(`partSize must not be smaller than ${minPartSize}`);
  }

  const init = await this.initMultipartUpload(name, options);
  const { uploadId } = init;
  const partSize = this._getPartSize(copySize, options.partSize);

  const checkpoint = {
    name,
    copySize,
    partSize,
    uploadId,
    doneParts: []
  };

  if (options && options.progress) {
    await options.progress(0, checkpoint, init.res);
  }

  return await this._resumeMultipartCopy(checkpoint, sourceData, options);
};

/*
 * Resume multipart copy from checkpoint. The checkpoint will be
 * updated after each successful part copy.
 * @param {Object} checkpoint the checkpoint
 * @param {Object} options
 */
proto._resumeMultipartCopy = async function _resumeMultipartCopy(checkpoint, sourceData, options) {
  if (this.isCancel()) {
    throw this._makeCancelEvent();
  }
  const { versionId = null } = options;
  const metaOpt = {
    versionId
  };
  const { copySize, partSize, uploadId, doneParts, name } = checkpoint;

  const partOffs = this._divideMultipartCopyParts(copySize, partSize, sourceData.startOffset);
  const numParts = partOffs.length;

  const uploadPartCopyOptions = {
    headers: {}
  };

  if (options.copyheaders) {
    copy(options.copyheaders).to(uploadPartCopyOptions.headers);
  }
  if (versionId) {
    copy(metaOpt).to(uploadPartCopyOptions);
  }

  const uploadPartJob = function uploadPartJob(self, partNo, source) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!self.isCancel()) {
          const pi = partOffs[partNo - 1];
          const range = `${pi.start}-${pi.end - 1}`;

          let result;
          try {
            result = await self.uploadPartCopy(name, uploadId, partNo, range, source, uploadPartCopyOptions);
          } catch (error) {
            if (error.status === 404) {
              throw self._makeAbortEvent();
            }
            throw error;
          }
          if (!self.isCancel()) {
            debug(`content-range ${result.res.headers['content-range']}`);
            doneParts.push({
              number: partNo,
              etag: result.res.headers.etag
            });
            checkpoint.doneParts = doneParts;

            if (options && options.progress) {
              await options.progress(doneParts.length / numParts, checkpoint, result.res);
            }
          }
        }
        resolve();
      } catch (err) {
        err.partNum = partNo;
        reject(err);
      }
    });
  };

  const all = Array.from(new Array(numParts), (x, i) => i + 1);
  const done = doneParts.map(p => p.number);
  const todo = all.filter(p => done.indexOf(p) < 0);
  const defaultParallel = 5;
  const parallel = options.parallel || defaultParallel;

  if (this.checkBrowserAndVersion('Internet Explorer', '10') || parallel === 1) {
    for (let i = 0; i < todo.length; i++) {
      if (this.isCancel()) {
        throw this._makeCancelEvent();
      }
      /* eslint no-await-in-loop: [0] */
      await uploadPartJob(this, todo[i], sourceData);
    }
  } else {
    // upload in parallel
    const errors = await this._parallelNode(todo, parallel, uploadPartJob, sourceData);

    const abortEvent = errors.find(err => err.name === 'abort');
    if (abortEvent) throw abortEvent;

    if (this.isCancel()) {
      throw this._makeCancelEvent();
    }

    // check errors after all jobs are completed
    if (errors && errors.length > 0) {
      const err = errors[0];
      err.message = `Failed to copy some parts with error: ${err.toString()} part_num: ${err.partNum}`;
      throw err;
    }
  }

  return await this.completeMultipartUpload(name, uploadId, doneParts, options);
};

proto._divideMultipartCopyParts = function _divideMultipartCopyParts(fileSize, partSize, startOffset) {
  const numParts = Math.ceil(fileSize / partSize);

  const partOffs = [];
  for (let i = 0; i < numParts; i++) {
    const start = partSize * i + startOffset;
    const end = Math.min(start + partSize, fileSize + startOffset);

    partOffs.push({
      start,
      end
    });
  }

  return partOffs;
};

/**
 * Get Object Meta
 * @param {String} bucket  bucket name
 * @param {String} name   object name
 * @param {Object} options
 */
proto._getObjectMeta = async function _getObjectMeta(bucket, name, options) {
  const currentBucket = this.getBucket();
  this.setBucket(bucket);
  const data = await this.head(name, options);
  this.setBucket(currentBucket);
  return data;
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307334, function(require, module, exports) {
const { isArray } = require('./utils/isArray');

const proto = exports;

proto._parallelNode = async function _parallelNode(todo, parallel, fn, sourceData) {
  const that = this;
  // upload in parallel
  const jobErr = [];
  let jobs = [];
  const tempBatch = todo.length / parallel;
  const remainder = todo.length % parallel;
  const batch = remainder === 0 ? tempBatch : (todo.length - remainder) / parallel + 1;
  let taskIndex = 1;
  for (let i = 0; i < todo.length; i++) {
    if (that.isCancel()) {
      break;
    }

    if (sourceData) {
      jobs.push(fn(that, todo[i], sourceData));
    } else {
      jobs.push(fn(that, todo[i]));
    }

    if (jobs.length === parallel || (taskIndex === batch && i === todo.length - 1)) {
      try {
        taskIndex += 1;
        /* eslint no-await-in-loop: [0] */
        await Promise.all(jobs);
      } catch (err) {
        jobErr.push(err);
      }
      jobs = [];
    }
  }

  return jobErr;
};

proto._parallel = function _parallel(todo, parallel, jobPromise) {
  const that = this;
  return new Promise(resolve => {
    const _jobErr = [];
    if (parallel <= 0 || !todo) {
      resolve(_jobErr);
      return;
    }

    function onlyOnce(fn) {
      return function (...args) {
        if (fn === null) throw new Error('Callback was already called.');
        const callFn = fn;
        fn = null;
        callFn.apply(this, args);
      };
    }

    function createArrayIterator(coll) {
      let i = -1;
      const len = coll.length;
      return function next() {
        return ++i < len && !that.isCancel() ? { value: coll[i], key: i } : null;
      };
    }

    const nextElem = createArrayIterator(todo);
    let done = false;
    let running = 0;
    let looping = false;

    function iterateeCallback(err) {
      running -= 1;
      if (err) {
        done = true;
        _jobErr.push(err);
        resolve(_jobErr);
      } else if (done && running <= 0) {
        done = true;
        resolve(_jobErr);
      } else if (!looping) {
        /* eslint no-use-before-define: [0] */
        if (that.isCancel()) {
          resolve(_jobErr);
        } else {
          replenish();
        }
      }
    }

    function iteratee(value, callback) {
      jobPromise(value)
        .then(result => {
          callback(null, result);
        })
        .catch(err => {
          callback(err);
        });
    }

    function replenish() {
      looping = true;
      while (running < parallel && !done && !that.isCancel()) {
        const elem = nextElem();
        if (elem === null || _jobErr.length > 0) {
          done = true;
          if (running <= 0) {
            resolve(_jobErr);
          }
          return;
        }
        running += 1;
        iteratee(elem.value, onlyOnce(iterateeCallback));
      }
      looping = false;
    }

    replenish();
  });
};

/**
 * cancel operation, now can use with multipartUpload
 * @param {Object} abort
 *        {String} anort.name object key
 *        {String} anort.uploadId upload id
 *        {String} anort.options timeout
 */
proto.cancel = function cancel(abort) {
  this.options.cancelFlag = true;

  if (isArray(this.multipartUploadStreams)) {
    this.multipartUploadStreams.forEach(_ => {
      if (_.destroyed === false) {
        const err = {
          name: 'cancel',
          message: 'cancel'
        };
        _.destroy(err);
      }
    });
  }
  this.multipartUploadStreams = [];
  if (abort) {
    this.abortMultipartUpload(abort.name, abort.uploadId, abort.options);
  }
};

proto.isCancel = function isCancel() {
  return this.options.cancelFlag;
};

proto.resetCancelFlag = function resetCancelFlag() {
  this.options.cancelFlag = false;
};

proto._stop = function _stop() {
  this.options.cancelFlag = true;
};

// cancel is not error , so create an object
proto._makeCancelEvent = function _makeCancelEvent() {
  const cancelEvent = {
    status: 0,
    name: 'cancel'
  };
  return cancelEvent;
};

// abort is not error , so create an object
proto._makeAbortEvent = function _makeAbortEvent() {
  const abortEvent = {
    status: 0,
    name: 'abort',
    message: 'upload task has been abort'
  };
  return abortEvent;
};

}, function(modId) { var map = {"./utils/isArray":1745133307270}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307335, function(require, module, exports) {
const copy = require('copy-to');
const callback = require('./callback');
const { deepCopyWith } = require('./utils/deepCopy');
const { isBuffer } = require('./utils/isBuffer');
const { omit } = require('./utils/omit');

const proto = exports;

/**
 * List the on-going multipart uploads
 * https://help.aliyun.com/document_detail/31997.html
 * @param {Object} options
 * @return {Array} the multipart uploads
 */
proto.listUploads = async function listUploads(query, options) {
  options = options || {};
  const opt = {};
  copy(options).to(opt);
  opt.subres = 'uploads';
  const params = this._objectRequestParams('GET', '', opt);
  params.query = query;
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);
  let uploads = result.data.Upload || [];
  if (!Array.isArray(uploads)) {
    uploads = [uploads];
  }
  uploads = uploads.map(up => ({
    name: up.Key,
    uploadId: up.UploadId,
    initiated: up.Initiated
  }));

  return {
    res: result.res,
    uploads,
    bucket: result.data.Bucket,
    nextKeyMarker: result.data.NextKeyMarker,
    nextUploadIdMarker: result.data.NextUploadIdMarker,
    isTruncated: result.data.IsTruncated === 'true'
  };
};

/**
 * List the done uploadPart parts
 * @param {String} name object name
 * @param {String} uploadId multipart upload id
 * @param {Object} query
 * {Number} query.max-parts The maximum part number in the response of the OSS. Default value: 1000
 * {Number} query.part-number-marker Starting position of a specific list.
 * {String} query.encoding-type Specify the encoding of the returned content and the encoding type.
 * @param {Object} options
 * @return {Object} result
 */
proto.listParts = async function listParts(name, uploadId, query, options) {
  options = options || {};
  const opt = {};
  copy(options).to(opt);
  opt.subres = {
    uploadId
  };
  const params = this._objectRequestParams('GET', name, opt);
  params.query = query;
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    res: result.res,
    uploadId: result.data.UploadId,
    bucket: result.data.Bucket,
    name: result.data.Key,
    partNumberMarker: result.data.PartNumberMarker,
    nextPartNumberMarker: result.data.NextPartNumberMarker,
    maxParts: result.data.MaxParts,
    isTruncated: result.data.IsTruncated,
    parts: result.data.Part || []
  };
};

/**
 * Abort a multipart upload transaction
 * @param {String} name the object name
 * @param {String} uploadId the upload id
 * @param {Object} options
 */
proto.abortMultipartUpload = async function abortMultipartUpload(name, uploadId, options) {
  this._stop();
  options = options || {};
  const opt = {};
  copy(options).to(opt);
  opt.subres = { uploadId };
  const params = this._objectRequestParams('DELETE', name, opt);
  params.successStatuses = [204];

  const result = await this.request(params);
  return {
    res: result.res
  };
};

/**
 * Initiate a multipart upload transaction
 * @param {String} name the object name
 * @param {Object} options
 * @return {String} upload id
 */
proto.initMultipartUpload = async function initMultipartUpload(name, options) {
  options = options || {};
  const opt = {};
  copy(options).to(opt);
  opt.headers = opt.headers || {};
  this._convertMetaToHeaders(options.meta, opt.headers);

  opt.subres = 'uploads';
  const params = this._objectRequestParams('POST', name, opt);
  params.mime = options.mime;
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    res: result.res,
    bucket: result.data.Bucket,
    name: result.data.Key,
    uploadId: result.data.UploadId
  };
};

/**
 * Upload a part in a multipart upload transaction
 * @param {String} name the object name
 * @param {String} uploadId the upload id
 * @param {Integer} partNo the part number
 * @param {File} file upload File, whole File
 * @param {Integer} start  part start bytes  e.g: 102400
 * @param {Integer} end  part end bytes  e.g: 204800
 * @param {Object} options
 */
proto.uploadPart = async function uploadPart(name, uploadId, partNo, file, start, end, options) {
  const data = {
    size: end - start
  };
  const isBrowserEnv = process && process.browser;
  isBrowserEnv
    ? (data.content = await this._createBuffer(file, start, end))
    : (data.stream = await this._createStream(file, start, end));
  return await this._uploadPart(name, uploadId, partNo, data, options);
};

/**
 * Complete a multipart upload transaction
 * @param {String} name the object name
 * @param {String} uploadId the upload id
 * @param {Array} parts the uploaded parts, each in the structure:
 *        {Integer} number partNo
 *        {String} etag  part etag  uploadPartCopy result.res.header.etag
 * @param {Object} options
 *         {Object} [options.callback] The callback parameter is composed of a JSON string encoded in Base64
 *         {String} options.callback.url  the OSS sends a callback request to this URL
 *         {String} [options.callback.host]  The host header value for initiating callback requests
 *         {String} options.callback.body  The value of the request body when a callback is initiated
 *         {String} [options.callback.contentType]  The Content-Type of the callback requests initiated
 *         {Boolean} [options.callback.callbackSNI] Whether OSS sends SNI to the origin address specified by callbackUrl when a callback request is initiated from the client
 *         {Object} [options.callback.customValue]  Custom parameters are a map of key-values, e.g:
 *                   customValue = {
 *                     key1: 'value1',
 *                     key2: 'value2'
 *                   }
 */
proto.completeMultipartUpload = async function completeMultipartUpload(name, uploadId, parts, options) {
  const completeParts = parts
    .concat()
    .sort((a, b) => a.number - b.number)
    .filter((item, index, arr) => !index || item.number !== arr[index - 1].number);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<CompleteMultipartUpload>\n';
  for (let i = 0; i < completeParts.length; i++) {
    const p = completeParts[i];
    xml += '<Part>\n';
    xml += `<PartNumber>${p.number}</PartNumber>\n`;
    xml += `<ETag>${p.etag}</ETag>\n`;
    xml += '</Part>\n';
  }
  xml += '</CompleteMultipartUpload>';

  options = options || {};
  let opt = {};
  opt = deepCopyWith(options, _ => {
    if (isBuffer(_)) return null;
  });
  opt.subres = { uploadId };
  opt.headers = omit(opt.headers, ['x-oss-server-side-encryption', 'x-oss-storage-class']);

  const params = this._objectRequestParams('POST', name, opt);
  callback.encodeCallback(params, opt);
  params.mime = 'xml';
  params.content = xml;

  if (!(params.headers && params.headers['x-oss-callback'])) {
    params.xmlResponse = true;
  }
  params.successStatuses = [200];
  const result = await this.request(params);

  if (options.progress) {
    await options.progress(1, null, result.res);
  }

  const ret = {
    res: result.res,
    bucket: params.bucket,
    name,
    etag: result.res.headers.etag
  };

  if (params.headers && params.headers['x-oss-callback']) {
    ret.data = JSON.parse(result.data.toString());
  }

  return ret;
};

/**
 * Upload a part in a multipart upload transaction
 * @param {String} name the object name
 * @param {String} uploadId the upload id
 * @param {Integer} partNo the part number
 * @param {Object} data the body data
 * @param {Object} options
 */
proto._uploadPart = async function _uploadPart(name, uploadId, partNo, data, options) {
  options = options || {};
  const opt = {};
  copy(options).to(opt);
  opt.headers = opt.headers || {};
  opt.headers['Content-Length'] = data.size;

  // Uploading shards does not require x-oss headers.
  opt.headers = omit(opt.headers, ['x-oss-server-side-encryption', 'x-oss-storage-class']);
  opt.subres = {
    partNumber: partNo,
    uploadId
  };

  const params = this._objectRequestParams('PUT', name, opt);
  params.mime = opt.mime;
  const isBrowserEnv = process && process.browser;
  isBrowserEnv ? (params.content = data.content) : (params.stream = data.stream);
  params.successStatuses = [200];
  params.disabledMD5 = options.disabledMD5;

  const result = await this.request(params);

  if (!result.res.headers.etag) {
    throw new Error(
      'Please set the etag of expose-headers in OSS \n https://help.aliyun.com/document_detail/32069.html'
    );
  }
  if (data.stream) {
    data.stream = null;
    params.stream = null;
  }
  return {
    name,
    etag: result.res.headers.etag,
    res: result.res
  };
};

}, function(modId) { var map = {"./callback":1745133307288,"./utils/deepCopy":1745133307309,"./utils/isBuffer":1745133307289,"./utils/omit":1745133307336}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307336, function(require, module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.omit = void 0;
function omit(originalObject, keysToOmit) {
    const cloneObject = Object.assign({}, originalObject);
    for (const path of keysToOmit) {
        delete cloneObject[path];
    }
    return cloneObject;
}
exports.omit = omit;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307337, function(require, module, exports) {
/* istanbul ignore next */
module.exports = function (OssClient) {
  /* istanbul ignore next */
  //   function objectRequestParams(method, name, options) {
  //     options = options || {};
  //     name = this._objectName(name);
  //     const authResource = `/${this.options.bucket}/${name}`;
  //     const params = {
  //       name,
  //       method,
  //       host: this.options.imageHost,
  //       resource: `/${name}`,
  //       timeout: options.timeout,
  //       authResource,
  //       ctx: options.ctx
  //     };
  //     if (options.headers) {
  //       params.headers = options.headers;
  //     }
  //     return params;
  //   }

  function ImageClient(options) {
    if (!(this instanceof ImageClient)) {
      return new ImageClient(options);
    }
    if (!options.bucket) {
      throw new Error('require bucket for image service instance');
    }
    if (!options.imageHost) {
      throw new Error('require imageHost for image service instance');
    }

    options.endpoint = options.imageHost;
    this.ossClient = new OssClient(options);
    this.ossClient.options.imageHost = options.imageHost;
    // this.ossClient._objectRequestParams = objectRequestParams;
  }

  /**
   * Image operations
   */

  ImageClient.prototype.get = async function get(name, file, options) {
    return await this.ossClient.get(name, file, options);
  };

  ImageClient.prototype.getStream = async function getStream(name, options) {
    return await this.ossClient.getStream(name, options);
  };

  ImageClient.prototype.getExif = async function getExif(name, options) {
    const params = this.ossClient._objectRequestParams('GET', `${name}@exif`, options);
    params.successStatuses = [200];

    let result = await this.ossClient.request(params);
    result = await this._parseResponse(result);
    return {
      res: result.res,
      data: result.data
    };
  };

  ImageClient.prototype.getInfo = async function getInfo(name, options) {
    const params = this.ossClient._objectRequestParams('GET', `${name}@infoexif`, options);
    params.successStatuses = [200];

    let result = await this.ossClient.request(params);
    result = await this._parseResponse(result);
    return {
      res: result.res,
      data: result.data
    };
  };

  ImageClient.prototype.putStyle = async function putStyle(styleName, style, options) {
    const params = this.ossClient._objectRequestParams('PUT', `/?style&styleName=${styleName}`, options);
    params.successStatuses = [200];
    params.content = `${'<?xml version="1.0" encoding="UTF-8"?>\n<Style><Content>'}${style}</Content></Style>`;

    let result = await this.ossClient.request(params);
    result = await this._parseResponse(result);
    return {
      res: result.res,
      data: result.data
    };
  };

  ImageClient.prototype.getStyle = async function getStyle(styleName, options) {
    const params = this.ossClient._objectRequestParams('GET', `/?style&styleName=${styleName}`, options);
    params.successStatuses = [200];

    let result = await this.ossClient.request(params);
    result = await this._parseResponse(result);
    return {
      res: result.res,
      data: result.data
    };
  };

  ImageClient.prototype.listStyle = async function listStyle(options) {
    const params = this.ossClient._objectRequestParams('GET', '/?style', options);
    params.successStatuses = [200];

    let result = await this.ossClient.request(params);
    result = await this._parseResponse(result);
    return {
      res: result.res,
      data: result.data.Style
    };
  };

  ImageClient.prototype.deleteStyle = async function deleteStyle(styleName, options) {
    const params = this.ossClient._objectRequestParams('DELETE', `/?style&styleName=${styleName}`, options);
    params.successStatuses = [204];

    const result = await this.ossClient.request(params);
    return {
      res: result.res
    };
  };

  ImageClient.prototype.signatureUrl = function signatureUrl(name) {
    return this.ossClient.signatureUrl(name);
  };

  ImageClient.prototype._parseResponse = async function _parseResponse(result) {
    const str = result.data.toString();
    const type = result.res.headers['content-type'];

    if (type === 'application/json') {
      const data = JSON.parse(str);
      result.data = {};
      if (data) {
        Object.keys(data).forEach(key => {
          result.data[key] = parseFloat(data[key].value, 10) || data[key].value;
        });
      }
    } else if (type === 'application/xml') {
      result.data = await this.ossClient.parseXML(str);
    }
    return result;
  };

  return ImageClient;
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307338, function(require, module, exports) {
const Base = require('sdk-base');
const util = require('util');
const ready = require('get-ready');
const copy = require('copy-to');
const currentIP = require('address').ip();

const RR = 'roundRobin';
const MS = 'masterSlave';

module.exports = function (OssClient) {
  function Client(options) {
    if (!(this instanceof Client)) {
      return new Client(options);
    }

    if (!options || !Array.isArray(options.cluster)) {
      throw new Error('require options.cluster to be an array');
    }

    Base.call(this);

    this.clients = [];
    this.availables = {};

    for (let i = 0; i < options.cluster.length; i++) {
      const opt = options.cluster[i];
      copy(options).pick('timeout', 'agent', 'urllib').to(opt);
      this.clients.push(new OssClient(opt));
      this.availables[i] = true;
    }

    this.schedule = options.schedule || RR;
    // only read from master, default is false
    this.masterOnly = !!options.masterOnly;
    this.index = 0;

    const heartbeatInterval = options.heartbeatInterval || 10000;
    this._checkAvailableLock = false;
    this._timerId = this._deferInterval(this._checkAvailable.bind(this, true), heartbeatInterval);
    this._ignoreStatusFile = options.ignoreStatusFile || false;
    this._init();
  }

  util.inherits(Client, Base);
  const proto = Client.prototype;
  ready.mixin(proto);

  const GET_METHODS = ['head', 'get', 'getStream', 'list', 'getACL'];

  const PUT_METHODS = ['put', 'putStream', 'delete', 'deleteMulti', 'copy', 'putMeta', 'putACL'];

  GET_METHODS.forEach(method => {
    proto[method] = async function (...args) {
      const client = this.chooseAvailable();
      let lastError;
      try {
        return await client[method](...args);
      } catch (err) {
        if (err.status && err.status >= 200 && err.status < 500) {
          // 200 ~ 499 belong to normal response, don't try again
          throw err;
        }
        // < 200 || >= 500 need to retry from other cluser node
        lastError = err;
      }

      for (let i = 0; i < this.clients.length; i++) {
        const c = this.clients[i];
        if (c !== client) {
          try {
            return await c[method].apply(client, args);
          } catch (err) {
            if (err.status && err.status >= 200 && err.status < 500) {
              // 200 ~ 499 belong to normal response, don't try again
              throw err;
            }
            // < 200 || >= 500 need to retry from other cluser node
            lastError = err;
          }
        }
      }

      lastError.message += ' (all clients are down)';
      throw lastError;
    };
  });

  // must cluster node write success
  PUT_METHODS.forEach(method => {
    proto[method] = async function (...args) {
      const res = await Promise.all(this.clients.map(client => client[method](...args)));
      return res[0];
    };
  });

  proto.signatureUrl = function signatureUrl(/* name */ ...args) {
    const client = this.chooseAvailable();
    return client.signatureUrl(...args);
  };

  proto.getObjectUrl = function getObjectUrl(/* name, baseUrl */ ...args) {
    const client = this.chooseAvailable();
    return client.getObjectUrl(...args);
  };

  proto._init = function _init() {
    const that = this;
    (async () => {
      await that._checkAvailable(that._ignoreStatusFile);
      that.ready(true);
    })().catch(err => {
      that.emit('error', err);
    });
  };

  proto._checkAvailable = async function _checkAvailable(ignoreStatusFile) {
    const name = `._ali-oss/check.status.${currentIP}.txt`;
    if (!ignoreStatusFile) {
      // only start will try to write the file
      await this.put(name, Buffer.from(`check available started at ${Date()}`));
    }

    if (this._checkAvailableLock) {
      return;
    }
    this._checkAvailableLock = true;
    const downStatusFiles = [];
    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i];
      // check 3 times
      let available = await this._checkStatus(client, name);
      if (!available) {
        // check again
        available = await this._checkStatus(client, name);
      }
      if (!available) {
        // check again
        /* eslint no-await-in-loop: [0] */
        available = await this._checkStatus(client, name);
        if (!available) {
          downStatusFiles.push(client._objectUrl(name));
        }
      }
      this.availables[i] = available;
    }
    this._checkAvailableLock = false;

    if (downStatusFiles.length > 0) {
      const err = new Error(
        `${downStatusFiles.length} data node down, please check status file: ${downStatusFiles.join(', ')}`
      );
      err.name = 'CheckAvailableError';
      this.emit('error', err);
    }
  };

  proto._checkStatus = async function _checkStatus(client, name) {
    let available = true;
    try {
      await client.head(name);
    } catch (err) {
      // 404 will be available too
      if (!err.status || err.status >= 500 || err.status < 200) {
        available = false;
      }
    }
    return available;
  };

  proto.chooseAvailable = function chooseAvailable() {
    if (this.schedule === MS) {
      // only read from master
      if (this.masterOnly) {
        return this.clients[0];
      }
      for (let i = 0; i < this.clients.length; i++) {
        if (this.availables[i]) {
          return this.clients[i];
        }
      }
      // all down, try to use this first one
      return this.clients[0];
    }

    // RR
    let n = this.clients.length;
    while (n > 0) {
      const i = this._nextRRIndex();
      if (this.availables[i]) {
        return this.clients[i];
      }
      n--;
    }
    // all down, try to use this first one
    return this.clients[0];
  };

  proto._nextRRIndex = function _nextRRIndex() {
    const index = this.index++;
    if (this.index >= this.clients.length) {
      this.index = 0;
    }
    return index;
  };

  proto._error = function error(err) {
    if (err) throw err;
  };

  proto._createCallback = function _createCallback(ctx, gen, cb) {
    return () => {
      cb = cb || this._error;
      gen.call(ctx).then(() => {
        cb();
      }, cb);
    };
  };
  proto._deferInterval = function _deferInterval(gen, timeout, cb) {
    return setInterval(this._createCallback(this, gen, cb), timeout);
  };

  proto.close = function close() {
    clearInterval(this._timerId);
    this._timerId = null;
  };

  return Client;
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1745133307339, function(require, module, exports) {
const debug = require('debug')('ali-oss:sts');
const crypto = require('crypto');
const querystring = require('querystring');
const copy = require('copy-to');
const AgentKeepalive = require('agentkeepalive');
const is = require('is-type-of');
const ms = require('humanize-ms');
const urllib = require('urllib');

const globalHttpAgent = new AgentKeepalive();

function STS(options) {
  if (!(this instanceof STS)) {
    return new STS(options);
  }

  if (!options || !options.accessKeyId || !options.accessKeySecret) {
    throw new Error('require accessKeyId, accessKeySecret');
  }

  this.options = {
    endpoint: options.endpoint || 'https://sts.aliyuncs.com',
    format: 'JSON',
    apiVersion: '2015-04-01',
    sigMethod: 'HMAC-SHA1',
    sigVersion: '1.0',
    timeout: '60s'
  };
  copy(options).to(this.options);

  // support custom agent and urllib client
  if (this.options.urllib) {
    this.urllib = this.options.urllib;
  } else {
    this.urllib = urllib;
    this.agent = this.options.agent || globalHttpAgent;
  }
}

module.exports = STS;

const proto = STS.prototype;

/**
 * STS opertaions
 */

proto.assumeRole = async function assumeRole(role, policy, expiration, session, options) {
  const opts = this.options;
  const params = {
    Action: 'AssumeRole',
    RoleArn: role,
    RoleSessionName: session || 'app',
    DurationSeconds: expiration || 3600,

    Format: opts.format,
    Version: opts.apiVersion,
    AccessKeyId: opts.accessKeyId,
    SignatureMethod: opts.sigMethod,
    SignatureVersion: opts.sigVersion,
    SignatureNonce: Math.random(),
    Timestamp: new Date().toISOString()
  };

  if (policy) {
    let policyStr;
    if (is.string(policy)) {
      try {
        policyStr = JSON.stringify(JSON.parse(policy));
      } catch (err) {
        throw new Error(`Policy string is not a valid JSON: ${err.message}`);
      }
    } else {
      policyStr = JSON.stringify(policy);
    }
    params.Policy = policyStr;
  }

  const signature = this._getSignature('POST', params, opts.accessKeySecret);
  params.Signature = signature;

  const reqUrl = opts.endpoint;
  const reqParams = {
    agent: this.agent,
    timeout: ms((options && options.timeout) || opts.timeout),
    method: 'POST',
    content: querystring.stringify(params),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    ctx: options && options.ctx
  };

  const result = await this.urllib.request(reqUrl, reqParams);
  debug('response %s %s, got %s, headers: %j', reqParams.method, reqUrl, result.status, result.headers);

  if (Math.floor(result.status / 100) !== 2) {
    const err = await this._requestError(result);
    err.params = reqParams;
    throw err;
  }
  result.data = JSON.parse(result.data);

  return {
    res: result.res,
    credentials: result.data.Credentials
  };
};

proto._requestError = async function _requestError(result) {
  const err = new Error();
  err.status = result.status;

  try {
    const resp = (await JSON.parse(result.data)) || {};
    err.code = resp.Code;
    err.message = `${resp.Code}: ${resp.Message}`;
    err.requestId = resp.RequestId;
  } catch (e) {
    err.message = `UnknownError: ${String(result.data)}`;
  }

  return err;
};

proto._getSignature = function _getSignature(method, params, key) {
  const that = this;
  const canoQuery = Object.keys(params)
    .sort()
    .map(k => `${that._escape(k)}=${that._escape(params[k])}`)
    .join('&');

  const stringToSign = `${method.toUpperCase()}&${this._escape('/')}&${this._escape(canoQuery)}`;

  debug('string to sign: %s', stringToSign);

  let signature = crypto.createHmac('sha1', `${key}&`);
  signature = signature.update(stringToSign).digest('base64');

  debug('signature: %s', signature);

  return signature;
};

/**
 * Since `encodeURIComponent` doesn't encode '*', which causes
 * 'SignatureDoesNotMatch'. We need do it ourselves.
 */
proto._escape = function _escape(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1745133307236);
})()
//miniprogram-npm-outsideDeps=["debug","stream-wormhole","xml2js","agentkeepalive","merge-descriptors","platform","utility","urllib","bowser","crypto","is-type-of","qs","lodash/toString","humanize-ms","url","lodash/isString","lodash/isArray","lodash/isObject","mime","dateformat","copy-to","path","fs","stream","pump","querystring","js-base64","assert","util","jstoxml","sdk-base","get-ready","address"]
//# sourceMappingURL=index.js.map