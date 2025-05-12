// pages/matter/matter.js
const artForm = require("../../subpackage/encyclopedia/artForm/src/artForm_data");

Page({
  data: {
    feed: {},
    feedIndex: 0
  },

  onLoad(options) {
    this.setData({
      feedIndex: parseInt(options.feedIndex),
      feed: artForm.data[this.data.feedIndex]
    });
    console.log('artForm的编号为', this.data.feedIndex);
    console.log(this.data.feed);
  },
});
