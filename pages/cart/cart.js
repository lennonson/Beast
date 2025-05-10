const items = require("../../data/cart_data")

Page({
  data: {
    cartItems: [],
    totalCount: 0,
    totalPrice: "0.00",
    chose: [],
    selectedItem: []
  },
  onLoad() {
    this.setData({
      cartItems: items.data
    })
    this.calculateTotal();
  },
  chooseGoods(e) {
    const id = e.currentTarget.dataset.id;
    console.log('当前id', id);
    let cartItems = this.data.cartItems.map(item => {
      if (item.id == id) {
        return { ...item, selected: !item.selected }; // 新对象，避免修改原数据
      }
      return item;
    });
    let selectedItem = cartItems.filter(item => item.selected);
    this.setData({
      selectedItem: selectedItem,
      cartItems: cartItems
    })
    this.calculateTotal();
  },
  calculateTotal() {
    const cartItems = this.data.selectedItem;
    const totalCount = cartItems.length;
    let totalPrice = 0; 
    for (let i = 0; i < totalCount; i++) {
        totalPrice += cartItems[i].price * cartItems[i].quantity;
    }
    this.setData({ totalCount, totalPrice });
  },
  increaseQuantity(e) {
    const id = e.currentTarget.dataset.id;
    const cartItems = this.data.cartItems.map(item => {
      if(item.id === id) {
        item.quantity += 1;
      }
      return item;
    });
    this.setData({ cartItems });
    this.calculateTotal();
  },
  decreaseQuantity(e) {
    const id = e.currentTarget.dataset.id;
    let cnt = this.data.totalCount;
    const cartItems = this.data.cartItems.map(item => {
      if(item.id === id && item.quantity > 1) {
        item.quantity -= 1;
        if (item.quantity === 0) {
          this.setData({
            totalCount: cnt - 1
          })
        }
      }
      return item;
    });
    this.setData({ cartItems });
    this.calculateTotal();
  },
  onCheckout() {
    wx.showToast({
      title: '结算功能待开发',
      icon: 'none'
    });
  }
});
