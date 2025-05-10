import { loginRequest } from "./service/index";
import { getCode } from "./service/login";

// app.js
App({
  globalData: {
    userInfo: null,
    imageUrls: [
      'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/1.%E8%B2%85%E7%8B%BC%E6%8F%92%E7%94%BB.jpg', 
                'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/2.%E6%A2%85%E8%8A%B1%E9%B9%BF%E6%8F%92%E7%94%BB.jpg',
                'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/3.%E7%8B%AC%E8%A7%92%E5%85%BD%E6%8F%92%E7%94%BB.jpg',
                'https://image-newbeast11.oss-cn-beijing.aliyuncs.com/4.%E9%BA%92%E9%BA%9F%E6%8F%92%E7%94%BB.jpg'
    ]
  },
  onLaunch() {
    // 展示本地存储能力
    const token = wx.getStorageSync('token') || ''
    // token.unshift(Date.now())
    wx.setStorageSync('token', token)
    // 检查token是否过期
    wx.cloud.init({
      env: 'cloud1-7gslprnl9929440e',
    })
  }
});
