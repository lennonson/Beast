// pages/sub3D/sub3D.js
const src = require("../../data/3D_data")
Page({
  data: {
    feed: [],
    title: '',
    videoSrc: ''
  },
  onLoad(options) {
    this.setData({
      feed: src.data
    });
    this.setData({
      title: this.data.feed[0].name,
      videoSrc: this.data.feed[0].video
    })
  },
  onReady() {

  },
  updateContent(e) {
    const index = e.currentTarget.dataset.index;
    const selectedItem = this.data.feed[index];

    this.setData({
      title: selectedItem.name,
      videoSrc: selectedItem.video
    })
  }
})