<app>
  <div class="app-section file-selector tile tile-centered">
    <div class="tile-icon">
      <label class="upload-button">
        <input ref="file" type="file" accept="audio/midi" onclick={ onClickFile } onchange={ onChangeFile }>
        <div class="btn btn-secondary">
          <i class="icon icon-upload"></i>SMF (*.mid, *.midi)
        </div>
      </label>
    </div>
    <div class="tile-content">
      <div class="tile-title">{ title || 'no title' }</div>
      <div class="tile-subtitle text-gray">{ filename || 'no file'}</div>
    </div>
    <div class="tile-action">
      <div class="encoding-selector columns">
        <div class="column col-5">
          <label class="form-label">encoding</label>
        </div>
        <div class="column col-7">
          <select ref="encoding" class="form-select" onchange={ onChangeEncoding }>
            <option value="AUTO">Auto</option>
            <option value="SJIS">Shift-JIS</option>
            <option value="UTF-8">UTF-8</option>
            <option value="UTF-16">UTF-16</option>
          </select>
        </div>
      </div>
    </div>
  </div>
  <div class="app-section load-msg text-italic" if={ loadMessage }>&#9658; { loadMessage }</div>
  <div class="app-section" if={ trackInfo && trackInfo.length > 0 }>
    <table class="table table-hover">
      <thead>
        <th>TrackName</th>
        <th>MaxPoly</th>
        <th>Volume<span class="text-gray">(%)</span></th>
        <th>Transpose</th>
        <th>Detune</th>
        <th>
          Output Poly
          <span class="badge" data-badge={ totalPoly }></span>
        </th>
      </thead>
      <tbody>
        <tr each={ trackInfo }>
          <td>{ name }</td>
          <td>{ maxPoly }</td>
          <td><input class="int-value" type="text" onchange={ onChangeVolume } value={ volume }></td>
          <td><input class="int-value" type="text" onchange={ onChangeTranspose } value={ transpose }></td>
          <td><input class="int-value" type="text" onchange={ onChangeDetune } value={ detune }></td>
          <td><input class="int-value" type="text" onchange={ onChangeOutputPoly } value={ outputPoly }></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="app-section">
    <button class="btn" disabled={ !output } onclick={ onClickMMLCopy }><i class="icon icon-bookmark"></i> MML Copy</button>
  </div>

  <div class="app-section mml-box">
    <pre ref="mml" class="code bg-dark" data-lang="MML">{ output || "'no outputs" }</pre>
  </div>

  <script>
    const Encoding = require('encoding-japanese');
    const SMFToMML = require('../smf2mml/SMFToMML.js');

    this.onChangeFile = () => {
      const file = this.refs.file.files[0];
      if (!file) {
        return;
      }
      let reader = new FileReader();
      reader.onload = () => {
        this.readSMF(file.name, reader.result);
      }
      reader.onerror = () => {
        this.loadMessage = `${filename} の読み込み中にエラーが発生しました: ${ reader.error }`;
      }
      reader.onabort = () => {
        this.loadMessage = `${filename} の読み込みを中断しました`;
      }
      reader.readAsArrayBuffer(file);
    }

    this.onClickFile = (e) => {
      e.currentTarget.value = "";
    }

    this.onChangeEncoding = () => {
      this.decodeName();
      this.update();
    }

    this.onChangeVolume = (e) => {
      const v = Math.min(100, Math.max(1, e.target.value |0));
      e.item.volume = (v === NaN) ? 100 : v;
      e.target.value = e.item.volume;
    };

    this.onChangeTranspose = (e) => {
      const v = Math.min(24, Math.max(-24, e.target.value |0));
      e.item.transpose = (v === NaN) ? 0 : v;
      e.target.value = e.item.transpose;
    };

    this.onChangeDetune = (e) => {
      const v = Math.min(64, Math.max(-64, e.target.value |0));
      e.item.detune = (v === NaN) ? 0 : v;
      e.target.value = e.item.detune;
    };

    this.onChangeOutputPoly = (e) => {
      const v = Math.min(16, Math.max(0, e.target.value |0));
      e.item.outputPoly = (v === NaN) ? 0 : v;
      e.target.value = e.item.outputPoly;
    };

    this.onClickMMLCopy = () => {
      const mml = this.refs.mml;
      const selection = document.getSelection();
      selection.selectAllChildren(mml);
      document.execCommand("copy");
      selection.removeAllRanges();
    }

    this.readSMF = (filename, buffer) => {
      try {
        const converter = new SMFToMML(buffer);
        const trackInfo = [];
        for (const track of converter.trackInfo) {
          const info = {
            totalNotes: track.totalNotes,
            ticks     : track.ticks,
            maxPoly   : track.maxPoly,
            volume    : 100,
            transpose : 0,
            detune    : 0,
            outputPoly: Math.min(8, track.maxPoly)
          };
          trackInfo.push(info);
        }
        this.filename = filename;
        this.converter = converter;
        this.trackInfo = trackInfo;
        this.decodeName();
        this.loadMessage = `${filename} を読み込みました`;
      } catch(e) {
        this.loadMessage = `${filename} の読み込みに失敗しました: ${e}`;
      }
      this.update();
    }

    this.decodeName = () => {
      if (!this.converter) {
        return;
      }
      const convOpts = {
        to: 'UNICODE', from: this.refs.encoding.value, type: 'string'
      };
      for (const [i, track] of this.converter.trackInfo.entries()) {
        this.trackInfo[i].name = Encoding.convert(
          new Uint8Array(track.name), convOpts);
      }
      this.title = Encoding.convert(
        new Uint8Array(this.converter.title), convOpts);
    }

    this.convert = () => {
      let tempo = true;
      let output = '';
      let channel = 0;
      let chars = 0;
      for (let [i, info] of this.trackInfo.entries()) {
        if (info.outputPoly <= 0) {
          continue;
        }
        const result = this.converter.convert(i, info.outputPoly, tempo, info.volume / 100, info.transpose, info.detune);
        tempo = false;
        output += `'[${info.name}] ${result.ticks} ticks\n`;
        for (const mml of result.mml) {
          output += `DATA ":${channel} ${mml}"\n`;
          chars += mml.length;
          channel++;
        }
      }
      if (output == '') {
        this.output = null;
        return;
      }
      output += 'DATA -1\n';
      this.output = `CLS
BGMSETD 128,@MMLDATA: BGMPLAY 128
REPEAT: WAIT: UNTIL BUTTON()
SNDSTOP
@MMLDATA
'Title: ${this.title} / ${chars} charctors
${output}`;
    }

    this.on('update', () => {
      if (!this.converter) {
        return;
      }
      this.totalPoly = this.trackInfo.reduce((p, tr) => p += tr.outputPoly, 0);
      this.convert();
    });

    this.loadMessage = 'MIDIファイルを読み込んでください.';
  </script>
  <style>
.upload-button > input[type="file"] {
  display: none;
}

.int-value {
  width: 4em;
  text-align: right;
}

.app-section {
  margin-bottom: 0.5em;
}

.mml-box > pre {
  font-family: monospace;
  padding: 0.5em;
  word-break: break-all;
  overflow: auto;
}

.encoding-selector > label {
  display: inline-block;
}
  </style>
</app>
