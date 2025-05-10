// pages/wenChuang.js
const category = require("../../data/wenChuang_data")
Page({
  data: {
    windowHeight: 0,
    currentIndex: 0,//左侧分类菜单选中索引
    toView: '',//右侧自动滑动到的id
    categories: []
  },
  onLoad(options) {
    const windowInfo = wx.getWindowInfo();
    const screenHeight = windowInfo.screenHeight; // 获取屏幕高度
    console.log('屏幕高度：', screenHeight);

    this.data.wenChuangList = getApp().globalData.wenChuang;
    this.setData({
        wenChuangList: this.data.wenChuangList,
        windowHeight: screenHeight,
        categories: category.data
      })
  },
  // 处理左侧点击
  clickWenChuang(e) {
    const { index, id } = e.currentTarget.dataset;
    console.log('左侧序号', e.currentTarget.dataset);
    this.setData({
      currentIndex: index,
      toView: id
    });
  },
 });