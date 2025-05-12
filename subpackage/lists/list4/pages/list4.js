Page({
    data: {
        images: []
    },
    onLoad() {
        const app = getApp();
        this.setData({
            images: app.globalData.imageUrls
        });
    },
    onImageSelect(e) {
        const { index } = e.currentTarget.dataset;
        wx.navigateTo({
            url: `/subpackage/lists/puzzle/pages/puzzle?selectedImageIndex=${index}`
        });
    }
});