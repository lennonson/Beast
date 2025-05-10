const systemInfo = wx.getSystemInfoSync();

const { shared, Easing } = wx.worklet;

const EasingFn = Easing.cubicBezier(0.4, 0.0, 0.2, 1.0);

const lerp = function (begin, end, t) {
  'worklet';
  return begin + (end - begin) * t;
};

const clamp = function (cur, lowerBound, upperBound) {
  'worklet';
  if (cur > upperBound) return upperBound;
  if (cur < lowerBound) return lowerBound;
  return cur;
};

const secondFloorCover = 'https://res.wx.qq.com/op_res/6Wt8f05P0Icnti4PBLtxfxza5VkItUCF1dQ6clDNr6c9KJxvxQMzWmJdkKXqHjOFjLp2fQAPV0JG1X6DwqGjyg';

Component({
  data: {
    paddingTop: 44,
    renderer: 'skyline',
    intoView: '',
    selected: 0,
    padding: [0, 16, 0, 16],
    refreshStatus: '下拉刷新',
    expSelected: 0
  },

  lifetimes: {
    created() {
      this.searchBarWidth = shared(100);
      this.navBarOpactiy = shared(1);
    },
    attached() {
      const padding = 10 * 2;
      const categoryItemWidth = (systemInfo.windowWidth - padding) / 5;
      this.setData({ categoryItemWidth, paddingTop: systemInfo.statusBarHeight, renderer: this.renderer });

      this.applyAnimatedStyle('.nav-bar', () => {
        'worklet';
        return {
          opacity: this.navBarOpactiy.value,
        };
      });

      this.applyAnimatedStyle('.search', () => {
        'worklet';
        return {
          width: `${this.searchBarWidth.value}%`,
        };
      });

      this.applyAnimatedStyle('.search-container', () => {
        'worklet';
        return {
          backgroundColor: (this.navBarOpactiy.value > 0 && this.renderer === 'skyline') ? 'transparent' : '#fff',
        };
      });

      wx.createSelectorQuery()
        .select('#scrollview')
        .node()
        .exec((res) => {
          this.scrollContext = res[0].node;
        });
    },
  },

  methods: {
    handleScrollStart(evt) {
      'worklet';
    },

    handleScrollUpdate(evt) {
      'worklet';
      const maxDistance = 60;
      const scrollTop = clamp(evt.detail.scrollTop, 0, maxDistance);
      const progress = EasingFn(scrollTop / maxDistance);
      this.searchBarWidth.value = lerp(100, 70, progress);
      this.navBarOpactiy.value = lerp(1, 0, progress);
    },

    handleScrollEnd(evt) {
      'worklet';
    },

    onPulling(e) {
      // console.log('onPulling:', e);
    },

    onStatusChange(e) {
      const status = e.detail.status;
      const twoLevelModes = [2, 3, 4]; // Opening, Leveling, Closing
      const isTwoLevel = twoLevelModes.includes(status);
      const refreshStatus = this.buildText(status);
      this.setData({
        isTwoLevel,
        refreshStatus,
      });
    },

  },
});
