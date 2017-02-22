var bsurl = require('utils/bsurl.js');
var nt = require('utils/nt.js')
App({
  onLaunch: function () {
    var cookie = wx.getStorageSync('cookie') || '';
    var gb = wx.getStorageSync("globalData");
    console.log(gb)
    gb && (this.globalData = gb)
    this.globalData.cookie = cookie
    var that = this;
    //播放列表中下一首
    wx.onBackgroundAudioStop(function () {
      nt.postNotificationName("music_toggle", {
        playing: false
      });
      if (that.globalData.globalStop) {
        return;
      }
      if (that.globalData.playtype != 2) {
        that.nextplay(that.globalData.playtype);
      } else {
        that.nextfm();
      }
    });
    this.likelist();
    //this.loginrefresh();
    wx.onBackgroundAudioPause(function () {
      nt.postNotificationName("music_toggle", {
        playing: false
      });
      that.globalData.globalStop = that.globalData.hide ? true : false;
      wx.getBackgroundAudioPlayerState({
        complete: function (res) {
          that.globalData.currentPosition = res.currentPosition ? res.currentPosition : 0
        }
      })
    })
  },
  loginrefresh: function () {
    wx.request({
      url: bsurl + 'login/refresh',
      data: { cookie: this.globalData.cookie },
      success: function (res) {
        // success
        console.log(res)
      }
    })
  },
  likelist: function () {
    var that = this
    this.globalData.cookie && wx.request({
      url: bsurl + 'likelist',
      data: { cookie: this.globalData.cookie },
      success: function (res) {
        that.globalData.staredlist = res.data.ids
      }
    })
  },
  nextplay: function (t, cb) {

    //播放列表中下一首
    this.preplay();
    if (this.globalData.playtype == 2) {
      this.nextfm();
      return;
    }
    var list = this.globalData.playtype == 1 ? this.globalData.list_am : this.globalData.list_dj;
    var index = this.globalData.playtype == 1 ? this.globalData.index_am : this.globalData.index_dj;
    if (t == 1) {
      index++;
    } else {
      index--;
    }
    index = index > list.length - 1 ? 0 : (index < 0 ? list.length - 1 : index);
    this.globalData.curplay = (this.globalData.playtype == 1 ? list[index] : list[index].mainSong) || {};
    for (var i = 0; i < this.globalData.staredlist.length; i++) {
      if (this.globalData.staredlist[i] == this.globalData.curplay.id) {
        this.globalData.curplay.starred = true;
        this.globalData.curplay.st = true;
      }
    }
    if (!this.globalData.curplay.id) return;
    if (this.globalData.playtype == 1) {
      this.globalData.index_am = index;
    } else {
      this.globalData.index_dj = index;
    }
    nt.postNotificationName("music_next", {
      music: this.globalData.curplay,
      playtype: this.globalData.playtype,
      index: this.globalData.playtype == 1 ? this.globalData.index_am : this.globalData.index_dj
    });
    this.seekmusic(this.globalData.playtype);
    cb && cb();
  },
  nextfm: function (cb) {
    //下一首fm
    this.preplay()
    var that = this;
    var list = that.globalData.list_fm;
    var index = that.globalData.index_fm;
    index++;
    this.globalData.playtype = 2;
    if (index > list.length - 1) {
      that.getfm();

    } else {
      console.log("获取下一首fm")
      that.globalData.index_fm = index;
      that.globalData.curplay = list[index];
      for (var i = 0; i < this.globalData.staredlist.length; i++) {
        if (this.globalData.staredlist[i] == this.globalData.curplay.id) {
          this.globalData.curplay.starred = true;
          this.globalData.curplay.st = true;
        }
      }
      that.seekmusic(2);
      cb && cb();
    }

  },
  preplay: function () {
    //歌曲切换 停止当前音乐
    nt.postNotificationName("music_toggle", {
      playing: false
    });
    this.globalData.globalStop = true;
    //  wx.stopBackgroundAudio();
  },
  getfm: function () {
    var that = this;
    wx.request({
      url: bsurl + 'fm',
      data: {
        cookie: that.globalData.cookie
      },
      method: 'GET',
      success: function (res) {
        that.globalData.list_fm = res.data.data;
        that.globalData.index_fm = 0;
        that.globalData.curplay = res.data.data[0];
        that.seekmusic(2);
      }
    })
  },
  stopmusic: function (type, cb) {
    var that = this;
    wx.pauseBackgroundAudio();
    nt.postNotificationName("music_toggle", {
      playing: false
    });
    wx.getBackgroundAudioPlayerState({
      complete: function (res) {
        that.globalData.currentPosition = res.currentPosition ? res.currentPosition : 0
      }
    })
  },
  seekmusic: function (type, cb, seek) {
    var that = this;
    var m = this.globalData.curplay;
    if (!m.id) return;
    this.globalData.playtype = type;

    if (cb || this.globalData.playtype == 3) {
      this.playing(type, cb, seek);
    } else {
      this.geturl(function () { that.playing(type, cb, seek); })
    }
  },
  playing: function (type, cb, seek) {
    var that = this
    var m = that.globalData.curplay
    wx.playBackgroundAudio({
      dataUrl: type == 1 ? m.url : m.mp3Url,
      title: m.name,
      success: function (res) {
        if (seek != undefined) {
          wx.seekBackgroundAudio({ position: seek })
        };
        that.globalData.globalStop = false;
        that.globalData.playtype = type;
        nt.postNotificationName("music_toggle", {
          playing: true
        });
        cb && cb();
      },
      fail: function () {
        if (type != 2) {
          that.nextplay(1)
        } else {
          that.nextfm();
        }
      }
    })
  },
  geturl: function (suc, err, cb) {
    var that = this;
    var m = that.globalData.curplay
    wx.request({
      url: bsurl + 'music/url',
      data: {
        id: m.id,
        br: m.duration ? ((m.hMusic && m.hMusic.bitrate) || (m.mMusic && m.mMusic.bitrate) || (m.lMusicm && m.lMusic.bitrate) || (m.bMusic && m.bMusic.bitrate)) : (m.privilege ? m.privilege.maxbr : ((m.h && m.h.br) || (m.m && m.m.br) || (m.l && m.l.br) || (m.b && m.b.br))),
        br: 128000,
        cookie: that.globalData.cookie
      },
      success: function (a) {
        a = a.data.data[0];
        if (!a.url) {
          err && err()
        } else {
          that.globalData.curplay.url = a.url;
          console.log(that.globalData.curplay)
          suc && suc()
        }
      }
    })
  },
  shuffleplay: function (shuffle) {
    //播放模式shuffle，1顺序，2单曲，3随机
    var that = this;
    that.globalData.shuffle = shuffle;
    if (shuffle == 1) {
      that.globalData.list_am = that.globalData.list_sf;
    }
    else if (shuffle == 2) {
      that.globalData.list_am = [that.globalData.curplay]
    }
    else {
      that.globalData.list_am = [].concat(that.globalData.list_sf);
      var sort = that.globalData.list_am;
      sort.sort(function () {
        return Math.random() - (0.5) ? 1 : -1;
      })

    }
    for (let s in that.globalData.list_am) {
      if (that.globalData.list_am[s].id == that.globalData.curplay.id) {
        that.globalData.index_am = s;
      }
    }
  },
  onShow: function () {
    this.globalData.hide = false
  },
  onHide: function () {
    this.globalData.hide = true
    wx.setStorageSync('globalData', this.globalData);
  },
  globalData: {
    hasLogin: false,
    hide: false,
    list_am: [],
    list_dj: [],
    list_fm: [],
    list_sf: [],
    index_dj: 0,
    index_fm: 0,
    index_am: 0,
    playtype: 1,
    curplay: {},
    shuffle: 1,
    globalStop: true,
    currentPosition: 0,
    staredlist: [],
    cookie: ""
  }
})
