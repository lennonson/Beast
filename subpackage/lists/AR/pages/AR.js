// pages/AR/AR.js
Page({
  data: {
    width: 0,
    height: 0,
    renderWidth: 0,
    renderHeight: 0,
    feed: []
  },
  onLoad(options) {
    const info = wx.getWindowInfo();
    const width = info.windowWidth;
    const height = info.windowHeight;
    const dpi = info.pixelRatio;
    console.log(info);
    this.setData({
      width: width * 2.4,
      height: height * 2,
      // height: height * 1.485,
      // height: height * 1.385,
      renderWidth: width * dpi,
      renderHeight: height * dpi
    });
  },
})