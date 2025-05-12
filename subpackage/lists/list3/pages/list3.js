Page({
  data: {
    // 新增，用于存放“点我吧”按钮对应的图片路径
    menu_add_imageSrc: 'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/5.%E9%B3%8C%E7%BA%B9%E6%A0%B7.png', 
    menu: [
      {
        // 替换icon为imageSrc，存放对应图片路径
        imageSrc: 'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/4.%E9%BA%92%E9%BA%9F%E6%8F%92%E7%94%BB.jpg', 
        name: "4.麒麟插画.jpg",
      },
      {
        imageSrc: 'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/4.%E9%BA%92%E9%BA%9F%E7%BA%B9%E6%A0%B7.png', 
        name: "4.麒麟纹样.png",
      },
      // 依次类推，修改每个对象中的图片路径
      {
        imageSrc: 'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/1.%E8%B2%85%E7%8B%BC%E6%8F%92%E7%94%BB.jpg', 
        name: "1.貅狼插画.jpg",
      },
      {
        imageSrc: 'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/3.%E7%8B%AC%E8%A7%92%E5%85%BD%E7%BA%B9%E6%A0%B7.png', 
        name: "3.独角兽纹样.png",
      },
      {
        imageSrc: 'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/3.%E7%8B%AC%E8%A7%92%E5%85%BD%E6%8F%92%E7%94%BB.jpg', 
        name: "3.独角兽插画.jpg",
      },
      {
        imageSrc: 'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/2.%E6%A2%85%E8%8A%B1%E9%B9%BF%E7%BA%B9%E6%A0%B7.png', 
        name: "2.梅花鹿纹样.png",
      },
      {
        imageSrc: 'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/2.%E6%A2%85%E8%8A%B1%E9%B9%BF%E6%8F%92%E7%94%BB.jpg', 
        name: "2.梅花鹿插画.jpg",
      },
      {
        imageSrc: 'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/1.%E8%B2%85%E7%8B%BC%E7%BA%B9%E6%A0%B7.png', 
        name: "1.貅狼纹样.png",
      },
    ],
    show_menu: false,
    currIndex: "",
    fullScreenImageVisible: false, // 控制全屏图片是否显示
    currentFullScreenImageSrc: "" // 当前全屏显示的图片路径
  },
  showMenu() {
    let { show_menu } = this.data;
    this.setData({
      show_menu: !show_menu,
      currIndex: "",
    });
  },
  clickActive(e) {
    let { index } = e.currentTarget.dataset;
    if (this.data.currIndex === index || index === undefined) return false;
    this.setData({
      currIndex: index,
      fullScreenImageVisible: true, // 点击小圆形时显示全屏图片
      currentFullScreenImageSrc: this.data.menu[index].imageSrc // 设置当前全屏显示的图片路径
    });
  },
  closeFullScreenImage() {
    this.setData({
      fullScreenImageVisible: false, // 关闭全屏图片
      currentFullScreenImageSrc: ""
    });
  }
});
