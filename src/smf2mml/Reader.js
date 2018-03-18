module.exports = class Reader {
  constructor(buffer) {
    this._buffer = buffer;
    this._dataview = new DataView(buffer);
    this._index = 0;
    this._prev_index = null;
  }

  index() {
    return this._index;
  }

  remains() {
    return this._buffer.byteLength - this._index;
  }

  uint8() {
    this._prev_index = this._index;
    return this._dataview.getUint8(this._index++);
  }

  uint16() {
    const v = this._dataview.getUint16(this._index);
    this._prev_index = this._index;
    this._index += 2;
    return v;
  }

  uint32() {
    const v = this._dataview.getUint32(this._index);
    this._prev_index = this._index;
    this._index += 4;
    return v;
  }

  uint14() {
    const v = this._dataview.getUint16(this._index, true);
    this._prev_index = this._index;
    this._index += 2;
    return ((v & 0x7f00) >> 1) | (v & 0x7f);
  }

  varlen() {
    this._prev = this._index;
    let value = 0;
    let t;
    do {
      t = this._dataview.getUint8(this._index++);
      value = (value << 7) | (t & 0x7f);
    } while (t > 0x7f);
    return value;
  }

  bytes(len) {
    const v = this._buffer.slice(this._index, this._index + len);
    this._prev_index = this._index;
    this._index += len;
    return v;
  }

  char(len) {
    const b = new Uint8Array(this._buffer, this._index, len)
    this._prev_index = this._index;
    this._index += len;
    return b.reduce((t, c) => t + String.fromCharCode(c), '');
  }

  skip(len) {
    this._prev_index = this._index;
    this._index += len;
  }

  undo() {
    if (this._prev_index === null) {
      return;
    }
    this._index = this._prev_index;
    this._prev = null;
  }
};
