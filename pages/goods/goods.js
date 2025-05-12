// pages/goods/goods.js
const goods = require("../../data/goods_data");
Page({
  data: {
    feedIndex: 0,
    feed: {}
  },
  onLoad(options) {
    this.setData({
      feedIndex: parseInt(options.feedIndex),
      feed: goods.data[this.data.feedIndex]
    })
  },
  onReady() {

  },
  onShow() {

  },
  onHide() {

  },
  onUnload() {

  },
  onPullDownRefresh() {

  },
  onReachBottom() {

  },
  onShareAppMessage() {

  }
})