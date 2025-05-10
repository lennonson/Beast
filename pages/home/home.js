const covers = require("../../data/cover")
const pieces = require("../../data/home_piece")
const encyclopedias = require("../../data/encyclopedia");
Page({
  data: {
    cover: [],
    piece: [],
    encyclopedia: []
  },
  onInputFocus: function (e) {
    wx.navigateTo({
      url: '/pages/search/search',
    })
    console.log('跳转了搜索页面');
  },
  getData: function(options) {
    console.log("load cover");
    this.setData({
      cover: covers.data.map(item => item.url),
      piece: pieces.data,
      encyclopedia: encyclopedias.data
    })
  },
  onLoad(options) {
    var that = this
    this.getData();
    console.log("加载了封面");
  }
});
