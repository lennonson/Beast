// pages/mine/mine.js
const db = wx.cloud.database()
Page({
  data: {
    avatar: '../../icon/beastLogo.png',
    nickname: '',
    logining: false,
    filledHead: false,
    openid: ''
  },
  Login() {
    wx.login({
      success: (e) => {
        if (e.code) {
          wx.request({
            url: 'https://api.weixin.qq.com/sns/jscode2session',
            method: 'get',
            data: {
              appid: 'wxd2cc99fd8f1a9580',
              secret: '8c7f92faf7ea4db00e1b09f530f12fc0',
              js_code: e.code,
              grant_type: 'authorization_code'
            },
            success: res => {
              if (res.data.openid) {
                console.log('成功获取openid:', res.data.openid); // 成功获取到openid
                this.setData({
                  openid: res.data.openid
                })
                console.log('已储存openid', this.data.openid);
              } else {
                console.error('获取openid失败:', res.data.errmsg); // 没有获取到openid，返回错误信息
              }
            },
            fail: err => {
              console.error('请求失败:', err.errMsg); // 请求失败，返回错误信息
            }
          })
        }
      },
    })
  },
  // getPhoneNumber (e) {
  //   console.log(e.detail.code)  // 动态令牌
  //   console.log(e.detail.errMsg) // 回调信息（成功失败都会返回）
  //   console.log(e.detail.errno)  // 错误码（失败时返回）
  // },


  loginMine(e) {
    this.setData({
      logining: true,
    })
  },
  getAvatar(e) {
    this.setData({
      avatar: e.detail.avatarUrl,
      filledHead: true
    })
  },
  getNick(e) {
    this.setData({
      nickname: e.detail.value
    })
  },
  cancel: function (e) {
    wx.showToast({
      title: '已取消登录！',
      icon: 'none'
    })
    this.setData({
      logining: false,
      nickname: '',
      avatar: '../../icon//beastLogo.png',
      filledHead: false
    })
  },
  confirm: function (e) {
    if (!this.data.nickname) {
      wx.showToast({
        title: '请输入昵称', // 提示内容
        icon: 'none',  // 不显示图标
        duration: 2000 // 提示框显示时间，单位是毫秒
      });
    } else {
      wx.showToast({
        title: '登录成功！',
      })
      this.Login();
      db.collection('user').add({
        data: {
          // openid: this.data.openid,
          nickname: this.data.nickname,
          head: this.data.avatar 
        }
        
      })
      this.setData({
        logining: false,
      })
    }
  }
})