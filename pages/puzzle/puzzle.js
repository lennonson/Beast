Page({
    data: {
        rows: 3,
        cols: 3,
        puzzlePieces: [],
        pos: [],
        pieceWidth: 0,
        pieceHeight: 0,
        emptyPieceIndex: 8,
        moves: 0,
        hintImage: '',
        selectedImageIndex: null
    },
    onLoad(options) {
        const { selectedImageIndex } = options;
        const app = getApp();
        const imageUrls = app.globalData.imageUrls;
        const hintImage = imageUrls[selectedImageIndex];
        this.setData({
            selectedImageIndex,
            hintImage,
            emptyPieceIndex: this.data.rows * this.data.cols - 1
        }, () => {
            this.initPuzzle();
        });
    },
    initPuzzle() {
      const { rows, cols } = this.data;
      // 先生成一个包含行列信息的对象数组
      let puzzlePieces = [];
      for (let i = 0; i < rows * cols; i++) {
        puzzlePieces.push({
          id: i,
          row:  Math.floor(i / cols),
          col:  i % cols,
        });
      }
      this.shuffleArray(puzzlePieces);
      const query = wx.createSelectorQuery();
      query.select('.puzzle-container').boundingClientRect((rect) => {
          if (rect) {
              const imageWidth = 2380;
              const imageHeight = 3408;
              const containerWidth = rect.width;
              const scale = containerWidth / imageWidth;
              const pieceWidth = (imageWidth / cols) * scale - 1;
              console.log('计算的拼图块宽度:', pieceWidth); 
              const pieceHeight = (imageHeight / rows) * scale;
              console.log('计算的拼图块高度:', pieceHeight); 
              this.setData({
                  puzzlePieces,
                  pieceWidth,
                  pieceHeight,
                  moves: 0
              });
          }
      }).exec();
    },
    shuffleArray(array) {
      // 保存原始位置
      const originalEmptyIndex = this.data.rows * this.data.cols - 1;
      let emptyIndex = originalEmptyIndex;
      
      // 随机移动空白块多次来打乱
      for (let i = 0; i < 100; i++) {
          const validMoves = [];
          const {rows, cols} = this.data;
          const emptyRow = Math.floor(emptyIndex / cols);
          const emptyCol = emptyIndex % cols;
          
          // 检查上下左右的有效移动
          if (emptyRow > 0) validMoves.push(emptyIndex - cols); // 上
          if (emptyRow < rows - 1) validMoves.push(emptyIndex + cols); // 下
          if (emptyCol > 0) validMoves.push(emptyIndex - 1); // 左
          if (emptyCol < cols - 1) validMoves.push(emptyIndex + 1); // 右
          
          // 随机选择一个有效移动
          const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
          [array[emptyIndex], array[randomMove]] = [array[randomMove], array[emptyIndex]];
          emptyIndex = randomMove;
      }
      console.log('初始empty', emptyIndex); 
      console.log(array);
      this.setData({
        emptyPieceIndex: emptyIndex
      })

      return array;
    },
    onPieceTap(e) {
      // 1. 从 dataset 中拿到当前点击块在数组中的位置 idx
      const { index } = e.currentTarget.dataset;
      const { puzzlePieces, emptyPieceIndex, rows, cols, moves } = this.data;
    
      // 2. 计算空白块和点击块的行列
      const emptyRow   = Math.floor(emptyPieceIndex / cols);
      const emptyCol   = emptyPieceIndex % cols;
      const currentRow = Math.floor(index / cols);
      const currentCol = index % cols;
    
      // 3. 只允许与空白块上下左右相邻的块移动
      const isAdjacent =
        (Math.abs(currentRow - emptyRow) === 1 && currentCol === emptyCol) ||
        (Math.abs(currentCol - emptyCol) === 1 && currentRow === emptyRow);
    
      if (!isAdjacent) {
        return;  // 不相邻就不处理
      }
    
      // 4. 交换两个位置的对象
      const newPieces = [...puzzlePieces];
      [ newPieces[index], newPieces[emptyPieceIndex] ] =
        [ newPieces[emptyPieceIndex], newPieces[index] ];
    
      // 5. 更新数据：新数组、空白块索引、步数 +1
      this.setData({
        puzzlePieces: newPieces,
        emptyPieceIndex: index,
        moves: moves + 1
      }, () => {
        // 6. 移动完成后再检查是否完成拼图
        this.checkWin();
      });
    },
    
    checkWin() {
        const { puzzlePieces, rows, cols } = this.data;
        let isWin = true;
        for (let i = 0; i < rows * cols - 1; i++) {
            if (puzzlePieces[i].id !== i) {
                isWin = false;
                break;
            }
        }
        if (isWin) {
            wx.showModal({
                title: '恭喜',
                content: `你用了 ${this.data.moves} 步完成拼图！`,
                showCancel: false
            });
        }
    }
});