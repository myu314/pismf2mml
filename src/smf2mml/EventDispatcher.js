const MMLChannel = require('./MMLChannel.js');

class EventDispatcher {
  constructor(numChannels) {
    this._timestamp = 0;
    this._channels = [];
    for (; numChannels > 0; numChannels--) {
      this._channels.push({
        mml: new MMLChannel(),
        note: null,
        timestamp: null,
      });
    }
  }

  next() {
    for (const ch of this._channels) {
      ch.mml.next();
    }
  }

  render() {
    const mml = [];
    for (const ch of this._channels) {
      mml.push(ch.mml.render());
    }
    return mml;
  }

  dispatch(events) {
    for (const ch of this._channels) {
      if (ch.note && ch.note.playing == false) {
        ch.mml.noteOff();
        ch.note = null;
      }
    }
    for (const event of events) {
      this._timestamp++;
      switch (event.type) {
        case 'note':
          this._play(event);
          break;
        case 'modulation':
          for (const ch of this._channels) {
            ch.mml.modulation(event.enabled);
          }
          break;
        case 'volume':
          for (const ch of this._channels) {
            ch.mml.volume(event.volume);
          }
          break;
        case 'panpot':
          for (const ch of this._channels) {
            ch.mml.panpot(event.panpot);
          }
          break;
        case 'program':
          for (const ch of this._channels) {
            ch.mml.program(event.program);
          }
          break;
        case 'pitch':
          for (const ch of this._channels) {
            ch.mml.pitch(event.pitch);
          }
          break;
        case 'tempo':
          this._channels[0].mml.tempo(event.tempo);
          break;
      }
    }
  }

  _play(event) {
    let target;
    for (const ch of this._channels) {
      if (ch.note === null) {
        target = ch;
        break;
      }
    }
    if (target === undefined) {
      target = this._channels[0];
      for (const ch of this._channels) {
        if (ch.note.key == event.key) {
          target = ch;
          break;
        }
        if (ch.timestamp < target.timestamp) {
          target = ch;
        }
      }
    }
    target.mml.noteOn(event.key, event.velocity);
    target.note = event;
    target.timestamp = this._timestamp;
  }
}

module.exports = EventDispatcher;
