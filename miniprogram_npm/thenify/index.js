module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {}, _tempexports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = __MODS__[modId].m; m._exports = m._tempexports; var desp = Object.getOwnPropertyDescriptor(m, "exports"); if (desp && desp.configurable) Object.defineProperty(m, "exports", { set: function (val) { if(typeof val === "object" && val !== m._exports) { m._exports.__proto__ = val.__proto__; Object.keys(val).forEach(function (k) { m._exports[k] = val[k]; }); } m._tempexports = val }, get: function () { return m._tempexports; } }); __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1745133307473, function(require, module, exports) {

var Promise = require('any-promise')
var assert = require('assert')

module.exports = thenify

/**
 * Turn async functions into promises
 *
 * @param {Function} fn
 * @return {Function}
 * @api public
 */

function thenify(fn, options) {
  assert(typeof fn === 'function')
  return createWrapper(fn, options)
}

/**
 * Turn async functions into promises and backward compatible with callback
 *
 * @param {Function} fn
 * @return {Function}
 * @api public
 */

thenify.withCallback = function (fn, options) {
  assert(typeof fn === 'function')
  options = options || {}
  options.withCallback = true
  return createWrapper(fn, options)
}

function createCallback(resolve, reject, multiArgs) {
  // default to true
  if (multiArgs === undefined) multiArgs = true
  return function(err, value) {
    if (err) return reject(err)
    var length = arguments.length

    if (length <= 2 || !multiArgs) return resolve(value)

    if (Array.isArray(multiArgs)) {
      var values = {}
      for (var i = 1; i < length; i++) values[multiArgs[i - 1]] = arguments[i]
      return resolve(values)
    }

    var values = new Array(length - 1)
    for (var i = 1; i < length; ++i) values[i - 1] = arguments[i]
    resolve(values)
  }
}

function createWrapper(fn, options) {
  options = options || {}
  var name = fn.name;
  name = (name || '').replace(/\s|bound(?!$)/g, '')
  var newFn = function () {
    var self = this
    var len = arguments.length
    if (options.withCallback) {
      var lastType = typeof arguments[len - 1]
      if (lastType === 'function') return fn.apply(self, arguments)
    }
    var args = new Array(len + 1)
    for (var i = 0; i < len; ++i) args[i] = arguments[i]
    var lastIndex = i
    return new Promise(function (resolve, reject) {
      args[lastIndex] = createCallback(resolve, reject, options.multiArgs)
      fn.apply(self, args)
    })
  }
  Object.defineProperty(newFn, 'name', { value: name })
  return newFn
}

}, function(modId) {var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1745133307473);
})()
//miniprogram-npm-outsideDeps=["any-promise","assert"]
//# sourceMappingURL=index.js.map