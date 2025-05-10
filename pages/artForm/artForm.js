const encyclopedia = require("../../data/encyclopedia");
const feeds = require("../../data/artForm_data");

Page({
  data: {
    feed: [],
    foreword: '',
    matter: '',
    screenHeight: 0,
    isUp: false,
  },

  onLoad(options) {
    const windowInfo = wx.getWindowInfo();
    const screenHeight = windowInfo.screenHeight; // 获取屏幕高度
    console.log('屏幕高度：', screenHeight);
    this.setData({
      screenHeight: screenHeight,
      feed: feeds.data,
      foreword: `transform: translateY(${screenHeight * 0}px); filter: opacity(1);`,
      matter: `transform: translateY(${screenHeight * 1}px); filter: opacity(0);`
    });
  },

  onArrowTap: function () {
    if (this.data.isUp) {
      this.slideDown();
    } else {
      this.slideUp();
    }
  },

  // 上滑动画（自适应屏幕）
  slideUp: function() {
    console.log('Executing slideUp');
    this.setData({
      foreword: `transform: translateY(-${this.data.screenHeight * 0.5}px); filter: opacity(0);`,
      matter: `transform: translateY(-${this.data.screenHeight * 0.885}px); filter: opacity(1);`,
      isUp: true,
    });
  },

  // 下滑动画（自适应屏幕）
  slideDown: function () {
    this.setData({
      foreword: `transform: translateY(${this.data.screenHeight * 0}px); filter: opacity(1);`,
      matter: `transform: translateY(${this.data.screenHeight * 0.8}px); filter: opacity(0);`,
      isUp: false,
    });
  },

  // 触摸滑动事件
  onTouchStart: function (e) {
    this.setData({
      startY: e.touches[0].pageY,
    });
  },

  onTouchEnd: function (e) {
    const endY = e.changedTouches[0].pageY;
    const deltaY = endY - this.data.startY;

    if (deltaY < -50 && !this.data.isUp) {
      this.slideUp();
    } else if (deltaY > 50 && this.data.isUp) {
      this.slideDown();
    }
  },
});
