# mload
开发一款自定义模块加载器,能自主管理不同的依赖并按照相应顺序加载,在多页面应用中能有效实现各个模块的拆分.

# 调用方式
```
  Mload.use(['/js/a.js', '/js/b.js'], function (a_data, b_data) {
      console.log(a_data, b_data);
  });
```
# 提示
不要在本地环境下运行.