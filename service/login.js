export const getCode = () => {
  new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        // 获取code
        resolve(res.code)
      },
    })
  })
}