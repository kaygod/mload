define(function (require, exports, module) {
  const c_data = require('./c.js');
  exports.a_data = {
    a: 123,
    c: c_data,
  };
});
