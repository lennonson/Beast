const txt = require("../../src/perfromance_data")

Page({
  data: {
    foreword: '',
    matter: '',
    text: [],
    onUpper: false
  },
  onLoad(options) {
    const windowInfo = wx.getWindowInfo();
    const screenHeight = windowInfo.screenHeight; // 获取屏幕高度
    console.log('屏幕高度：', screenHeight);

    this.setData({
      screenHeight: screenHeight,
      foreword: `transform: translateY(${screenHeight * 0.1}px); filter: opacity(1);`,
      matter: `transform: translateY(${screenHeight * 1}px); filter: opacity(0);`,
      text: txt.data
    });
  },
  onArrowTap: function () {
    this.slideUp();
  },
  //上滑动画
  slideUp: function() {
    this.setData({
      foreword: `transform: translateY(0px); filter: opacity(0);`,
      matter: `transform: translateY(-${this.data.screenHeight * 0.68}px); filter: opacity(1);`,
      isUp: true,
    })
  },
  //下滑动画
  slideDown: function () {
    this.setData({
      foreword: `transform: translateY(${this.data.screenHeight * 0.1}px); filter: opacity(1);`,
      matter: `transform: translateY(${this.data.screenHeight * 0.8}px); filter: opacity(0);`,
      isUp: false,
    });
  },

  onTouchStart: function (e) {
    this.setData({
      startY: e.touches[0].pageY,
    });
  },
  onTouchEnd: function (e) {
    const endY = e.changedTouches[0].pageY;
    const deltaY = endY - this.data.startY;

    if (deltaY < -50) {
      this.slideUp();
    } else if (deltaY > 50 ) {
        if (this.data.pos == 3) {
          if (this.data.onUpper)
            this.slideDown();
        } else this.slideDown();
    }
  },
})