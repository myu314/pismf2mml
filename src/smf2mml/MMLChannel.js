const ticksToMMLLength = require('./ticksToMMLLength.js');

function keyToMML(key) {
  const KEY_NAME = [
    "C","C#","D","D#","E","F","F#","G","G#","A","A#","B"
  ];
  if (key < 12) {
    return {
      octave: 1,
      name: 'C'+'-'.repeat(12 - key)
    };
  }
  if (key < 120) {
    return {
      octave: key / 12 - 1 |0,
      name: KEY_NAME[key % 12]
    };
  }
  return {
    octave: 8,
    name: 'B'+'#'.repeat(key - 119)
  };
}

class MMLChannel {
  constructor(volumeRate, pitchShift) {
    this._notes = [{
      type      : 'rest',
      length    : 0,
      tempo     : 120,
      program   : 0,
      detune    : 0,
      key       : 0,
      volume    : 100,
      panpot    : 64,
      modulation: false,
    }];
    this._key       = 0;
    this._velocity  = 127;
    this._exVolume  = 1;
    this._pitch     = 0;
    this._program   = 0;
    this._volumeRate = volumeRate;
    this._pitchShift = pitchShift;
  }

  render() {
    const topNote = this._notes[0];
    let prevProgram = 0;
    let prevDetune = 0;
    let prevVolume = 100;
    let prevTempo = 120;
    let prevPanpot = 64;
    let prevModulation = false;
    let prevOctave = 4;
    let loop = false;
    let mml = `O${prevOctave}V${prevVolume}`;
    for (let i = 0; i < this._notes.length; i++) {
      const curr = this._notes[i];
      const next = this._notes[i + 1];
      if (!loop && curr.loop) {
        loop = true;
        mml += `[@${curr.program}P${curr.panpot}${curr.modulation ? '@MON' : '@MOF'}@D${curr.detune}`;
        prevProgram = curr.program;
        prevPanpot = curr.panpot;
        prevModulation = curr.modulation;
        prevDetune = curr.detune;
      }
      if (curr.tempo !== prevTempo) {
        mml += `T${curr.tempo}`;
        prevTempo = curr.tempo;
      }
      if (curr.length === 0) { // for tempo track
        break;
      }
      if (curr.panpot !== prevPanpot) {
        mml += `P${curr.panpot}`;
        prevPanpot = curr.panpot;
      }
      if (curr.modulation !== prevModulation) {
        mml += curr.modulation ? '@MON' : '@MOF';
        prevModulation = curr.modulation;
      }
      if (curr.type === 'rest') {
        const len = ticksToMMLLength(curr.length);
        mml += len.map((l) => {
          return 'R' + l.mmlLength + '.'.repeat(l.dot);
        }).join('');
      } else {
        if (curr.type === 'note' && curr.program != prevProgram) {
          mml += `@${curr.program}`;
          prevProgram = curr.program;
        }
        if (curr.volume != prevVolume) {
          const d = curr.volume - prevVolume;
          const ad = Math.abs(d);
          mml += ((d < 0) ? ')' : '(') + ((ad > 1) ? ad : '');
          prevVolume = curr.volume;
        }
        if (curr.detune != prevDetune) {
          mml += `@D${curr.detune}`;
          prevDetune = curr.detune;
        }
        const keyName = keyToMML(curr.key);
        if (keyName.octave != prevOctave) {
          const d = keyName.octave - prevOctave;
          mml += ((d < 0) ? '>' : '<').repeat(Math.abs(d));
          prevOctave = keyName.octave;
        }
        const len = ticksToMMLLength(curr.length);
        mml += len.map((l) => {
          return keyName.name + l.mmlLength + '.'.repeat(l.dot);
        }).join('&');
        if (next && next.type === 'tie') {
          mml += '&';
        }
      }
    }
    if (loop) {
      mml += ']';
    }
    return mml;
  }

  next() {
    this._currentNote.length++;
  }

  noteOff() {
    this._setParameter({ type: 'rest' });
  }

  noteOn(key, velocity) {
    this._key = key;
    this._velocity = velocity * this._volumeRate;
    this.noteOff();
    this._setParameter(Object.assign(
      {
        type: 'note',
        volume: this._currentVolume,
        program: this._program,
      },
      this._currentKey
    ));
  }

  pitch(value) {
    this._pitch = value;
    if (this._currentNote.type === 'rest') {
      return;
    }
    this._setParameter(this._currentKey);
  }

  program(number) {
    this._program = number;
  }

  modulation(mod) {
    this._setParameter({ modulation: mod });
  }

  volume(volume) {
    this._exVolume = volume;
    if (this._currentNote.type === 'rest') {
      return;
    }
    this._setParameter({ volume: this._currentVolume });
  }

  panpot(panpot) {
    this._setParameter({ panpot });
  }

  tempo(tempo) {
    this._setParameter({ tempo: Math.min(512, Math.max(1, tempo)) });
  }

  loopStart() {
    this._setParameter({ loop: true });
  }

  get _currentNote() {
    return this._notes[this._notes.length - 1];
  }

  _setParameter(param) {
    const currentNote = this._currentNote;
    if (currentNote.length == 0) {
      return Object.assign(currentNote, param);
    }
    for (const [k, v] of Object.entries(param)) {
      if (v === currentNote[k]) {
        continue;
      }
      const newNote = Object.assign({}, currentNote);
      this._notes.push(newNote);
      newNote.length = 0;
      delete newNote.loop;
      if (newNote.type === 'note') {
        newNote.type = 'tie';
      }
      return Object.assign(newNote, param);
    }
    return currentNote;
  }

  get _currentVolume() {
    return Math.min(127, Math.max(0, this._velocity * this._exVolume |0));
  }

  get _currentKey() {
    const pitch = Math.min((128 << 6) - 1, Math.max(0,
      (this._key << 6) + this._pitch + this._pitchShift
    ));
    return { detune: pitch & 0x3f, key: pitch >> 6 };
  }
}

module.exports = MMLChannel;
