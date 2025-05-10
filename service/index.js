class Request {
  constructor(baseURL) {
    this.baseURL = baseURL
  }
  request (options) {
    const { url } = options
    return new Promise((reslove, reject) => {
      wx.request({
        ...options,
        url: this.baseURL + url,
        success: (res) => {
          reslove(res.data)
        },
        fail: (err) => {
          console.log('err', err);
        }
      })
    })
  }
  get(options) {
    return this.request({...options, method: 'get'})
  }
  post(options) {
    return this.request({...options, method: 'post'})
  }
}
export const loginRequest = new Request('')