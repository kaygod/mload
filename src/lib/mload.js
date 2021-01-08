(function (global) {
  var cache_data = {}; //缓存对象
  var tmp_data; //临时缓存数据
  var mid = 1;

  /**
   * 状态码
   */
  var code = {
    created: 1, //创建
    feching: 2, //获取依赖
    loaed: 3, //加载完毕
  };

  /**
   * 模块构造函数
   * @param {*} params
   */
  function Mload(params) {
    this.id = params.id;
    this.libs = params.libs || [];
    this.status = code.created;
    this.cnum = 0; //有几个子级没有加载完
    this.parent_lib = {}; //有哪些父级引用我
    this.exports = {};
  }

  /**
   * 开启模块加载
   */
  Mload.prototype.loadModule = function () {
    var m = this;
    m.status = code.feching; //准备加载依赖
    var libs = m.libs;
    for (var i = 0; i < libs.length; i++) {
      var seed = getModule(libs[i]); //获取子模块
      if (seed.status === code.created) {
        //开始加载子模块
        seed.parent_lib[m.id] = 1; //将父模块全部注册进来
        seed.fetchFile();
      }
    }
  };

  /**
   * 请求子文件
   */
  Mload.prototype.fetchFile = function () {
    var m = this;

    var callback = function () {
      if (!tmp_data) {
        //脚本请求执行完毕后会将结果存储在全局变量tmp_data中
        return false;
      }
      m.factory = tmp_data.factory; //工厂函数
      var result = childPathHandler(m.id, tmp_data.libs); //解析的依赖列表
      var libs = [];
      for (var i = 0; i < result.length; i++) {
        //为了防止a文件引入b,b里面又引入a造成的问题.
        if (getModule(result[i]).status === code.created) {
          libs.push(result[i]);
        }
      }
      m.libs = libs;
      m.cnum = libs.length; //依赖的数量
      if (m.cnum == 0) {
        //加载完毕,没有依赖了
        m.loaded();
      } else {
        m.loadModule();
      }
    };

    requestFile(m.id, callback);
  };

  /**
   * 加载完毕
   */
  Mload.prototype.loaded = function () {
    var m = this;
    m.status = code.loaed;
    if (m.callback) {
      m.callback();
      return false;
    }
    var parent_lib = m.parent_lib;

    for (var key in parent_lib) {
      var parent_module = getModule(key);
      parent_module.cnum--;
      if (parent_module.cnum == 0) {
        //子依赖全部加载完毕
        parent_module.loaded();
      }
    }
  };

  /**
   * 获取模块的导出数据
   */
  Mload.prototype.exec = function () {
    var m = this;

    if (JSON.stringify(m.exports)!=="{}") {
      //已经将导出数据缓存了
      return m.exports;
    }

    var factory = m.factory;

    var require = function (path) {
      path = childPathHandler(m.id, path); //规范路径格式
      var seed = getModule(path);
      if (seed.libs.indexOf(m.id) !== -1) {
        return seed.exports;
      }
      return seed.exec();
    };

    var module = {
      exports: {},
    };

    factory.apply(null, [require, module.exports, module]);

    for(var key in module.exports){
      m.exports[key] = module.exports[key];
    }

    return m.exports;
  };

  /**
   * 初始方法,加载脚本文件.将libs的文件全部加载请求,如果有下一级继续去请求
   */
  Mload.use = function (libs, callback) {
    if (Object.prototype.toString.call(libs) !== '[object Array]') {
      libs = [libs];
    }
    var root_id = getPath() + getModuleId();
    libs = pathHandler(libs); //对路径处理
    var m = getModule(root_id);
    m.callback = function () {
      var result = [];
      for (var i = 0; i < libs.length; i++) {
        var seed = getModule(libs[i]);
        result.push(seed.exec()); //获取模块的导出数据
      }
      callback.apply(null, result);
    };
    m.libs = libs;
    m.cnum = libs.length; //依赖的数量
    m.loadModule();
  };

  /**
   * 定义模块
   */
  function define(factory) {
    if (Object.prototype.toString.call(factory) !== '[object Function]') {
      //非函数阻止往下执行
      return false;
    }

    var factory_string = factory.toString();

    //匹配出 require("c.js") 里面的 c.js

    var reg = /\brequire\((['"])([a-zA-Z\d\.-_]+)\1\)/g;

    var libs = [];

    factory_string.replace(reg, function (match, $1, $2) {
      libs.push($2);
      return match;
    });

    var obj = {
      factory: factory,
      libs: libs,
    };

    tmp_data = obj;
  }

  /**
   * 请求js文件
   * @param {*文件的url} id
   * @param {*请求成功后的回调函数} callback
   */
  function requestFile(id, callback) {
    var script = document.createElement('SCRIPT');
    script.src = id;
    document.body.appendChild(script);
    script.onload = function () {
      script.remove();
      callback();
    };
  }

  /**
   * require函数中的路径处理
   * @param {*} path
   */
  function childPathHandler(parent_path, child_path) {
    var is_array = true; //默认是数组
    var result = [];
    //如果路径以 ./ 开头,就寻找相对路径
    if (Object.prototype.toString.call(child_path) !== '[object Array]') {
      child_path = [child_path];
      is_array = false;
    }
    for (var i = 0; i < child_path.length; i++) {
      if (/^\.\/.+$/.test(child_path[i])) {
        parent_path = parent_path.slice(0, parent_path.lastIndexOf('/') + 1);
        var path = child_path[i].slice(2);
        result.push(parent_path + path);
      } else {
        //寻找绝对路径
        result.push(pathHandler(child_path));
      }
    }
    if (is_array) {
      return result;
    } else {
      return result[0];
    }
  }

  /**
   * 路径处理
   */
  function pathHandler(libs) {
    var is_array = true; //是数组吗

    if (Object.prototype.toString.call(libs) !== '[object Array]') {
      //不是数组转化成数组
      libs = [libs];
      is_array = false;
    }

    for (var i = 0; i < libs.length; i++) {
      libs[i] = resolveHandler(libs[i]);
    }

    /**
     *
     * 1.对地址做格式化
     *
     *     ./a/b/c = a/b/c   /a/b/c = a/b/c  a/b/./c = a/b/c
     *
     *     /a/b/../c = a/b/c
     *
     * 2.将相对地址转化成绝对地址
     *
     * @param {*路径} path
     */
    function resolveHandler(path) {
      // 1.处理 /./ 和 /b/../
      path = path.replace(/(\/\.\/)|(\/[a-zA-Z\d-]+\/\.\.\/)/gi, '');
      // 2.处理头部的 ./ 和 /
      path = path.replace(
        /^(\.)?\/([a-zA-Z\d-\.\/]+)$/,
        function (match, $1, $2) {
          return $2;
        }
      );
      path = getPath() + path;
      return path;
    }

    if (is_array) {
      return libs;
    } else {
      return libs[0];
    }
  }

  /**
   * 获取项目路径
   */
  function getPath() {
    var path = document.URL.match(
      /^(http(s)?:\/\/([a-zA-Z\d-\.:]+\/){1,})[^#\?]*[#\?]?.*$/
    )[1];
    if (path == null) {
      return document.URL + '/';
    } else {
      return path;
    }
  }

  /**
   * 获取模块id
   */
  function getModuleId() {
    return mid++;
  }

  /**
   * 获取module
   */
  function getModule(id) {
    return cache_data[id]
      ? cache_data[id]
      : (cache_data[id] = new Mload({ id }));
  }

  global.Mload = Mload;

  global.define = define;
})(window);
