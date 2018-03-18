const TinySMF = require('./TinySMF.js');
const EventFilter = require('./EventFilter.js');
const EventDispatcher = require('./EventDispatcher.js');

class SMFToMML {
  constructor(smfBuffer) {
    const smf = TinySMF.read(smfBuffer);
    if (smf.header.format != 1) {
      throw `Format ${smf.header.format} is not supported.`;
    }
    if (smf.header.division & 0x8000) {
      throw 'SMPTE format is not supported.';
    }
    const tpqn = smf.header.division;
    const trackInfo = smf.tracks.map((track) => {
      let name;
      let totalNotes = 0;
      let poly = 0;
      let maxPoly = 0;
      let ticks = 0;
      for (const event of track) {
        switch (event.type) {
          case TinySMF.Type.SEQUENCE_TRACK_NAME:
            name = name || event.data;
            break;
          case TinySMF.Type.NOTE_ON:
            totalNotes++;
            poly++;
            maxPoly = Math.max(maxPoly, poly);
            break;
          case TinySMF.Type.NOTE_OFF:
            poly--;
            break;
          case TinySMF.Type.END_OF_TRACK:
            ticks = Math.ceil(48 * event.time / tpqn);
            break;
        }
      }
      return { name, totalNotes, maxPoly, ticks };
    });
    this._tpqn = tpqn;
    this._title = trackInfo.shift().name;
    this._trackInfo = trackInfo;
    this._tempoTrack = smf.tracks.shift();
    this._tracks = smf.tracks;
  }

  get trackInfo() {
    return this._trackInfo;
  }

  get title() {
    return this._title;
  }

  convert(trackNumber, numChannels, withTempo, volume = 1, transpose = 0) {
    const iTPQN = this._tpqn;
    const oTPQN = 48;
    const srcTempo = new EventFilter(
      withTempo ? this._tempoTrack : [], iTPQN, oTPQN);
    const srcTarget = new EventFilter(
      this._tracks[trackNumber], iTPQN, oTPQN, volume, transpose);
    const dispatcher = new EventDispatcher(numChannels);
    let ticks = 0;
    while (true) {
      dispatcher.dispatch(srcTempo.next());
      dispatcher.dispatch(srcTarget.next());
      if (srcTarget.completed) {
        break;
      }
      dispatcher.next();
      ticks++;
    }
    return { mml: dispatcher.render(), ticks }
  }
}

module.exports = SMFToMML;
