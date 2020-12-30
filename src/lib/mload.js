(function (global) {
  var cache_data = {}; //缓存对象
  var tmp_data; //临时缓存数据

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
  }

  /**
   * 开启模块加载
   */
  Mload.prototype.loadModule = function () {
    var m = this;
    m.status = code.feching;
    var libs = m.libs;
    for (var i = 0; i < libs.length; i++) {
      var seed = getModule(libs[i]); //获取子模块
      if (seed.staus === code.created) {
        //开始加载子模块
        seed.parent_lib[m.id] = 1;
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
        return false;
      }
      m.factory = tmp_data.factory;
      m.libs = tmp_data.libs;
      m.cnum = tmp_data.libs.length;
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
      //m.callback();
      return false;
    }
    var parent_lib = m.parent_lib;
    for (var i = 0; i < parent_lib.length; i++) {
      var parent_module = getModule(parent_lib[i]);
      parent_module.cnum--;
      if (parent_module.cnum == 0) {
        parent_module.loaded();
      }
    }
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
    m.libs = libs;
    m.cnum = libs.length;
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
      libs: pathHandler(libs),
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
   * 路径处理
   */
  function pathHandler(libs) {
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
      path = path.repalce(
        /^(\.)?\/([a-zA-Z\d-\.\/]+)$/,
        function (match, $1, $2) {
          return $2;
        }
      );
      path = getPath() + path;
      return path;
    }
  }

  /**
   * 获取项目路径
   */
  function getPath() {
    var path = document.URL.match(
      /^(http(s)?:\/\/([a-zA-Z\d-\.]+\/){1,})[^#\?]*[#\?]?.*$/
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
