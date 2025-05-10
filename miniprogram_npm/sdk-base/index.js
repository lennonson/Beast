module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {}, _tempexports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = __MODS__[modId].m; m._exports = m._tempexports; var desp = Object.getOwnPropertyDescriptor(m, "exports"); if (desp && desp.configurable) Object.defineProperty(m, "exports", { set: function (val) { if(typeof val === "object" && val !== m._exports) { m._exports.__proto__ = val.__proto__; Object.keys(val).forEach(function (k) { m._exports[k] = val[k]; }); } m._tempexports = val }, get: function () { return m._tempexports; } }); __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1745133307458, function(require, module, exports) {
/**
 * Copyright(c) dead_horse and other contributors.
 * MIT Licensed
 *
 * Authors:
 * 	 dead_horse <dead_horse@qq.com>
 *   fengmk2 <fengmk2@gmail.com> (http://fengmk2.com)
 */



/**
 * Module dependencies.
 */

var ready = require('get-ready');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = Base;

function Base() {
  EventEmitter.call(this);
  this.on('error', this.defaultErrorHandler.bind(this));
}

/**
 * inherits from EventEmitter
 */

util.inherits(Base, EventEmitter);

ready.mixin(Base.prototype);

Base.prototype.defaultErrorHandler = function (err) {
  if (this.listeners('error').length > 1) {
    // ignore defaultErrorHandler
    return;
  }
  console.error('\n[%s][pid: %s][%s][%s] %s: %s \nError Stack:\n  %s',
    Date(), process.pid, this.constructor.name, __filename, err.name,
    err.message, err.stack);

  // try to show addition property on the error object
  // e.g.: `err.data = {url: '/foo'};`
  var additions = [];
  for (var key in err) {
    if (key === 'name' || key === 'message') {
      continue;
    }

    additions.push(util.format('  %s: %j', key, err[key]));
  }
  if (additions.length) {
    console.error('Error Additions:\n%s', additions.join('\n'));
  }
  console.error();
};

}, function(modId) {var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1745133307458);
})()
//miniprogram-npm-outsideDeps=["get-ready","events","util"]
//# sourceMappingURL=index.js.map