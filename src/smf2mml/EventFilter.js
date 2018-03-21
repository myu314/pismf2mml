const TinySMF = require('./TinySMF.js');

class EventFilter {
  constructor(source, inputTPQN, outputTPQN) {
    this._source = source;
    this._index = 0;
    this._count = 0;
    this._inputTPQN = inputTPQN;
    this._outputTPQN = outputTPQN;
    this._notes = [];
    this._pedal = false;
    this._volume = 1;
    this._expression = 1;
    this._rpnSelect = false;
    this._rpnLSB = 127;
    this._rpnMSB = 127;
    this._range = 2;
    this._bank = 0;
  }

  next() {
    const outputs = [];
    this._count += this._inputTPQN;
    const nextTicks = this._count / this._outputTPQN;
    for (; this._index < this._source.length; this._index++) {
      const event = this._source[this._index];
      if (event.time >= nextTicks) {
        break;
      }
      switch (event.type) {
        case TinySMF.Type.NOTE_OFF: {
          let key = event.key;
          for (const note of this._notes) {
            if (!note.noteoff && note.key == key) {
              note.noteoff = true;
              if (this._pedal == false) {
                note.playing = false;
              }
              break;
            }
          }
          break;
        }
        case TinySMF.Type.NOTE_ON: {
          const note = {
            type      : 'note',
            key       : event.key,
            velocity  : event.velocity |0,
            noteoff   : false,
            playing   : true,
          };
          outputs.push(note);
          this._notes.push(note);
          break;
        }
        case TinySMF.Type.CONTROL_CHANGE:
          switch (event.number) {
            case 0x01:   // modulation
              outputs.push({
                type    : 'modulation',
                enabled : (event.value >= 0x40),
              });
              break;
            case 0x07:   // volume
            case 0x0b:
              if (event.number == 0x07) {
                this._volume = (event.value + 1) / 128;
              } else {
                this._expression = (event.value + 1) / 128;
              }
              outputs.push({
                type    : 'volume',
                volume  : this._volume * this._expression
              });
              break;
            case 0x0a:  // panpot
              outputs.push({
                type    : 'panpot',
                panpot  : event.value
              });
              break;
            case 0x20:  // bank(LSB)
              this._bank = event.value;
              break;
            case 0x40:  // pedal
              this._pedal = (event.value >= 0x40);
              if (this._pedal == false) {
                for (const note of this._notes) {
                  if (note.noteoff) {
                    note.playing = false;
                  }
                }
              }
              break;
            case 0x06:  // Data(MSB)
              if (this._rpnSelect &&
                this._rpnLSB == 0 && this._rpnMSB == 0) {
                this._range = event.value;
              }
              break;
            case 0x62:  // NRPN
            case 0x63:
              this._rpnSelect = false;
              break;
            case 0x64:  // RPN (LSB)
              this._rpnSelect = true;
              this._rpnLSB = event.value;
              break;
            case 0x65:  // RPN (MSB)
              this._rpnSelect = true;
              this._rpnMSB = event.value;
              break;
            case 0x6f:  // CC#111 Loop start
              outputs.push({ type  : 'loopstart' });
              break;
          }
          break;
        case TinySMF.Type.PROGRAM_CHANGE:
          outputs.push({
            type    : 'program',
            program : ((this._bank << 7) | event.program) & 0x1ff,
          });
          break;
        case TinySMF.Type.PITCH_BEND:
          outputs.push({
            type  : 'pitch',
            pitch : Math.round(this._range * 64 * event.value / 8192),
          });
          break;
        case TinySMF.Type.SET_TEMPO:
          outputs.push({
            type  : 'tempo',
            tempo : event.bpm |0  // XXX: round?
          });
          break;
        default:
          break;
      }
    }
    this._notes = this._notes.filter((note) => note.playing);
    return outputs;
  }

  get completed() {
    return this._index >= this._source.length;
  }
}

module.exports = EventFilter;
