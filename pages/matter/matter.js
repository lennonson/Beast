// pages/matter/matter.js
const artForm = require("../../data/artForm_data");

Page({
  data: {
    feed: [],
    feedIndex: 0
  },

  onLoad(options) {
    this.setData({
      feed: artForm.data,
      feedIndex: parseInt(options.feedIndex)
    });
  },
});
