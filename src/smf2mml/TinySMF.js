const Reader = require('./Reader.js');

const Group = {
  CHANNEL_VOICE_MESSAGE   : 0,
  CHANNEL_MODE_MESSAGE    : 1,
  SYSTEM_COMMON_MESSAGE   : 2,
  SYSTEM_REALTIME_MESSAGE : 3,
  META_EVENT_MESSAGE      : 4
};

Object.freeze(Group);

const Type = {
  // Channel Voice Message
  NOTE_OFF                : 0,
  NOTE_ON                 : 1,
  POLY_KEY_PRESSURE       : 2,
  CONTROL_CHANGE          : 3,
  PROGRAM_CHANGE          : 4,
  CHANNEL_PRESSURE        : 5,
  PITCH_BEND              : 6,
  // System Common Message
  SYSTEM_EXCLUSIVE        : 7,
  MTC_QUATER_FRAME        : 8,
  SONG_POSITION_POINTER   : 9,
  SONG_SELECT             : 10,
  TUNE_REQUEST            : 11,
  SYSTEM_EXCLUSIVE2       : 12,
  // System Realtime Message
  TIMING_CLOCK            : 13,
  PLAY                    : 14,
  CONTINUE                : 15,
  STOP                    : 16,
  ACTIVE_SENSING          : 17,
  SYSTEM_RESET            : 18,
  // Meta Event Message
  SEQUENCE_NUMBER         : 19,
  TEXT_EVENT              : 20,
  COPYRIGHT_NOTICE        : 21,
  SEQUENCE_TRACK_NAME     : 22,
  INSTRUMENT_NAME         : 23,
  LYRIC                   : 24,
  MARKER                  : 25,
  CUE_POINT               : 26,
  MIDI_CHANNEL_PREFIX     : 27,
  MIDI_PORT_PREFIX        : 28,
  END_OF_TRACK            : 29,
  SET_TEMPO               : 30,
  SMPTE_OFFSET            : 31,
  TIME_SIGNATURE          : 32,
  KEY_SIGNATURE           : 33,
  SEQUENCER_SPECIFIC_META_EVENT: 34,
  UNKNOWN_META_EVENT      : 35,
};

Object.freeze(Type);

function readSMF(source) {
  "use strict";
  const reader = new Reader(source);
  let header;
  let tracks = [];
  while (reader.remains() >= 8) {
    switch (reader.char(4)) {
      case 'MThd':
        header = readHeader(reader);
        break;
      case 'MTrk':
        tracks.push(readTrack(reader));
        break;
      default:
        reader.skip(reader.uint32());
        break;
    }
  }
  if (header === undefined) {
    throw "Can't find header chunk.";
  }
  return { header, tracks };
}

function readHeader(reader) {
  "use strict";
  const chunkSize = reader.uint32();
  if (chunkSize != 6) {
    throw "Length of header chunk must be 6.";
  }
  const retval = {};
  retval.format = reader.uint16();
  retval.numTracks = reader.uint16();
  retval.division = reader.uint16();
  if (retval.division & 0x8000) {
    retval.framerate = 256 - (retval.division >> 8);
    retval.ticksPerFrame = retval.division & 0xff;
  }
  return retval;
}

function readTrack(reader) {
  "use strict";
  const chunkSize = reader.uint32();
  const last = reader.index() + chunkSize;
  const events = [];
  let currentTime = 0;
  let runningStatus = 0;
  while (reader.index() < last) {
    currentTime += reader.varlen();
    const event = { time: currentTime };
    events.push(event);
    let status = reader.uint8();
    if (status < 0x80) {
      if (runningStatus < 0x80) {
        throw "Can't find status byte.";
      }
      status = runningStatus;
      reader.undo();
    }
    // Channel Voice/Mode Message
    if (status <= 0xef) {
      runningStatus = status;
      event.group = Group.CHANNEL_VOICE_MESSAGE;
      event.channel = status & 0x0f;
      switch (status & 0xf0) {
        case 0x80:
          event.type = Type.NOTE_OFF;
          event.key = reader.uint8();
          event.velocity = reader.uint8();
          break;
        case 0x90:
          event.key = reader.uint8();
          event.velocity = reader.uint8();
          event.type = (event.velocity > 0) ? Type.NOTE_ON : Type.NOTE_OFF;
          break;
        case 0xa0:
          event.type = Type.POLY_KEY_PRESSURE;
          event.key = reader.uint8();
          event.pressure = reader.uint8();
          break;
        case 0xb0:
          event.type = Type.CONTROL_CHANGE;
          event.number = reader.uint8();
          event.value = reader.uint8();
          if (event.number >= 0x78) {
            event.group = Group.CHANNEL_MODE_MESSAGE;
          }
          break;
        case 0xc0:
          event.type = Type.PROGRAM_CHANGE;
          event.program = reader.uint8();
          break;
        case 0xd0:
          event.type = Type.CHANNEL_PRESSURE;
          event.pressure = reader.uint8();
          break;
        case 0xe0:
          event.type = Type.PITCH_BEND;
          event.value = reader.uint14() - 8192;
          break;
      }
      continue;
    }
    // System Common Message
    if (status <= 0xf7) {
      runningStatus = 0;
      event.group = Group.SYSTEM_COMMON_MESSAGE;
      switch (status) {
        case 0xf0:
          event.type = Type.SYSTEM_EXCLUSIVE;
          event.data = reader.bytes(reader.varlen());
          break;
        case 0xf1: {
          let v = reader.uint8();
          event.type = Type.MTC_QUATER_FRAME;
          event.msgtype = v >> 4;
          event.value = v & 0x0f;
          break;
        }
        case 0xf2:
          event.type = Type.SONG_POSITION_POINTER;
          event.position = reader.uint14();
          break;
        case 0xf3:
          event.type = Type.SONG_SELECT;
          event.number = rader.uint8();
          break;
        case 0xf4:
        case 0xf5:
          throw "Undefined status found: 0x" + status.toString(16);
        case 0xf6:
          event.type = Type.TUNE_REQUEST;
          break;
        case 0xf7:
          event.type = Type.SYSTEM_EXCLUSIVE2;
          event.data = reader.bytes(reader.varlen());
          break;
      }
      continue;
    }
    // System Realtime Message
    if (status <= 0xfe) {
      event.group = Group.SYSTEM_REALTIME_MESSAGE;
      switch (status) {
        case 0xf8:
          event.type = Type.TIMING_CLOCK;
          break;
        case 0xf9:
          event.type = Type.PLAY;
          break;
        case 0xfb:
          event.type = Type.CONTINUE;
          break;
        case 0xfc:
          event.type = Type.STOP;
          break;
        case 0xfe:
          event.type = Type.ACTIVE_SENSING;
          break;
        case 0xff:
          event.type = Type.SYSTEM_RESET;
          break;
        default:
          throw "Undefined status found: 0x" + status.toString(16);
      }
      continue;
    }
    // Meta Event Message
    event.group = Group.META_EVENT_MESSAGE;
    event.metaType = reader.uint8();
    const data = new Uint8Array(reader.bytes(reader.varlen()));
    event.data = data.buffer;
    switch (event.metaType) {
      case 0x00:
        if (data.byteLength != 2) {
          throw "Length of 'Sequence Number' must be 2.";
        }
        event.type = Type.SEQUENCE_NUMBER;
        event.number = data[0];
        break;
      case 0x01:
        event.type = Type.TEXT_EVENT;
        break;
      case 0x02:
        event.type = Type.COPYRIGHT_NOTICE;
        break;
      case 0x03:
        event.type = Type.SEQUENCE_TRACK_NAME;
        break;
      case 0x04:
        event.type = Type.INSTRUMENT_NAME;
        break;
      case 0x05:
        event.type = Type.LYRIC;
        break;
      case 0x06:
        event.type = Type.MARKER;
        break;
      case 0x07:
        event.type = Type.CUE_POINT;
        break;
      case 0x20:
        if (data.byteLength != 1) {
          throw "Length of 'MIDI Channel Prefix' must be 1.";
        }
        event.type = Type.MIDI_CHANNEL_PREFIX;
        event.channel = data[0];
        break;
      case 0x21:
        if (data.byteLength != 1) {
          throw "Length of 'MIDI Port Prefix' must be 1.";
        }
        event.type = Type.MIDI_PORT_PREFIX;
        event.channel = data[0];
        break;
      case 0x2f:
        if (data.byteLength != 0) {
          throw "Length of 'End of Track' must be 1.";
        }
        event.type = Type.END_OF_TRACK;
        break;
      case 0x51:
        if (data.byteLength != 3) {
          throw "Length of 'Set Tempo' must be 3.";
        }
        event.type = Type.SET_TEMPO;
        event.microsec = (data[0] << 16) | (data[1] << 8) | data[2];
        event.bpm = 60000000 / event.microsec;
        break;
      case 0x54:
        if (data.byteLength != 5) {
          throw "Length of 'SMPTE Offset' must be 5.";
        }
        event.type = Type.SMPTE_OFFSET;
        event.hours = data[0];
        event.minutes = data[1];
        event.seconds = data[2];
        event.frames = data[3];
        event.subframes = data[4];
        break;
      case 0x58:
        if (data.byteLength != 4) {
          throw "Length of 'Time Signature' must be 4.";
        }
        event.type = Type.TIME_SIGNATURE;
        event.numerator = data[0];
        event.denominator = 2 ** data[1];
        event.metronome = data[2];
        event.num32notes = data[3];
        break;
      case 0x59:
        if (data.byteLength != 2) {
          throw "Length of 'Key Signature' must be 2.";
        }
        event.type = Type.KEY_SIGNATURE;
        event.key = (data[0] << 24) >> 24;
        event.scale = data[1];
        break;
      case 0x7f:
        event.type = Type.SEQUENCER_SPECIFIC_META_EVENT;
        break;
      default:
        event.type = Type.UNKNOWN_META_EVENT;
        break;
    }
  }
  return events;
}

module.exports = {
  Group,
  Type,
  read: readSMF
};
