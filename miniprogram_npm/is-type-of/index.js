module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {}, _tempexports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = __MODS__[modId].m; m._exports = m._tempexports; var desp = Object.getOwnPropertyDescriptor(m, "exports"); if (desp && desp.configurable) Object.defineProperty(m, "exports", { set: function (val) { if(typeof val === "object" && val !== m._exports) { m._exports.__proto__ = val.__proto__; Object.keys(val).forEach(function (k) { m._exports[k] = val[k]; }); } m._tempexports = val }, get: function () { return m._tempexports; } }); __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1745133307409, function(require, module, exports) {


var utils = require('core-util-is');
var isStearm = require('isstream');
// wait for https://github.com/miguelmota/is-class/pull/6 merge
var isClass = require('is-class-hotfix');

/**
 * Expose all methods in core-util-is
 */

Object.keys(utils).map(function (name) {
  exports[transform(name)] = utils[name];
});

/**
 * Stream detected by isstream
 */

exports.stream = isStearm;
exports.readableStream = isStearm.isReadable;
exports.writableStream = isStearm.isWritable;
exports.duplexStream = isStearm.isDuplex;

/**
 * Class detected by is-class
 */
 exports.class = isClass;

/**
 * Extend method
 */

exports.finite = Number.isFinite;

exports.NaN = Number.isNaN;

exports.generator = function (obj) {
  return obj
    && 'function' === typeof obj.next
    && 'function' === typeof obj.throw;
};

exports.generatorFunction = function (obj) {
  return obj
    && obj.constructor
    && 'GeneratorFunction' === obj.constructor.name;
};

exports.asyncFunction = function (obj) {
  return obj
    && obj.constructor
    && 'AsyncFunction' === obj.constructor.name;
};

exports.promise = function (obj) {
  return obj
    && 'function' === typeof obj.then;
};

var MAX_INT_31 = Math.pow(2, 31);

exports.int = function (obj) {
  return utils.isNumber(obj)
    && obj % 1 === 0;
};

exports.int32 = function (obj) {
  return exports.int(obj)
    && obj < MAX_INT_31
    && obj >= -MAX_INT_31;
};

exports.long = function (obj) {
  return exports.int(obj)
    && (obj >= MAX_INT_31 || obj < -MAX_INT_31);
};

exports.Long = function (obj) {
  return exports.object(obj)
    && exports.number(obj.high)
    && exports.number(obj.low);
};

exports.double = function (obj) {
  return utils.isNumber(obj)
    && !isNaN(obj)
    && obj % 1 !== 0;
};

exports.bigInt = function (obj) {
  return 'bigint' === typeof obj;
};
exports.bigint = exports.bigInt;

/**
 * override core-util-is
 */

exports.date = function isDate(obj) {
  return obj instanceof Date;
};

exports.regExp = function isRegExp(obj) {
  return obj instanceof RegExp;
};
exports.regexp = exports.regExp;

exports.error = function isError(obj) {
  return obj instanceof Error;
};

exports.array = Array.isArray;

/**
 * transform isNull type to null
 * @param {[type]} m [description]
 * @return {[type]} [description]
 */

function transform(m) {
  var name = m.slice(2);
  name = name[0].toLowerCase() + name.slice(1);
  return name;
}

}, function(modId) {var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1745133307409);
})()
//miniprogram-npm-outsideDeps=["core-util-is","isstream","is-class-hotfix"]
//# sourceMappingURL=index.js.map