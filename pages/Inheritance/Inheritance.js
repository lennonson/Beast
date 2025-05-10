// pages/Inheritance/Inheritance.js
const txt = require("../../data/Inheritance_data")

Page({
  data: {
    startY: 0,
    text: [],
    pos: 1,
    onUpper: false,
    foreword: '',
    matter: '',
    matter2: '',
    screenHeight: 0
  },
  onLoad(options) {
    const windowInfo = wx.getWindowInfo();
    const screenHeight = windowInfo.screenHeight; // 获取屏幕高度
    console.log('屏幕高度：', screenHeight);

    this.setData({
      screenHeight: screenHeight,
      foreword: `transform: translateY(${screenHeight * 0.1}px); filter: opacity(1);`,
      matter: `transform: translateY(${screenHeight * 1.1}px); filter: opacity(1);`,
      matter2: `transform: translateY(${screenHeight * 1}px); filter: opacity(1);`,
      text: txt.data
    });
  },
  onArrowTap: function () {
    this.slideUp();
  },
  //上滑动画
  slideUp: function() {
    console.log('Executing slideUp');
    if (this.data.pos == 1) {
      this.setData({
        foreword: `transform: translateY(-${this.data.screenHeight * 1}px); filter: opacity(1);`,
        matter: `transform: translateY(-${this.data.screenHeight * 0.9}px); filter: opacity(1);`,
        pos: 2
      });
    } else if (this.data.pos == 2) {
      this.setData({
        matter: `transform: translateY(-${this.data.screenHeight * 2}px); filter: opacity(1);`,
        matter2: `transform: translateY(-${this.data.screenHeight * 1.88}px); filter: opacity(1);`,
        pos: 3,
        onUpper: false
      });
    }
  },
  //下滑动画
  slideDown: function () {
    if (this.data.pos == 2) {
      this.setData({
        foreword: `transform: translateY(${this.data.screenHeight * 0.1}px); filter: opacity(1);`,
        matter: `transform: translateY(${this.data.screenHeight * 1.1}px); filter: opacity(1);`,
        pos: 1
      });
    } else if (this.data.pos == 3 && this.data.onUpper) {
      this.setData({
        matter: `transform: translateY(-${this.data.screenHeight * 0.9}px); filter: opacity(1);`,
        matter2: `transform: translateY(${this.data.screenHeight * 1}px); filter: opacity(1);`,
        pos: 2
      });
    }
  },
  uppered: function () {
    this.setData({
      onUpper: true
    })
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
        this.slideDown();
    }
  },
})