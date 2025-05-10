// components/xr-start/index.js
Page({
  data: {

  },
  onLoad(options) {

  },
  handleAssetsProgress: function ({detail}) {
    console.log('assets progress', detail.value);
  },
  handleReady: function ({detail}) {
    this.scene = detail.value;
  },
  handleAssetsLoaded: function({detail}) {
    wx.showToast({
      title: '点击屏幕放置'
    });
    this.scene.event.add('touchstart', () => {
      this.scene.ar.placeHere('setitem', true);
      // 获取 anchor 模型节点并隐藏
      // const anchorNode = this.scene.getNodeById('anchorModel');
      // if (anchorNode) {
      //   anchorNode.visible = false;
      // }
    });
  }
})