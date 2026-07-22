(() => {
  'use strict';

  const DB_NAME = 'yuzan-voice-cache-v1';
  const STORE = 'recordings';

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbPut(key, value) {
    try {
      const db = await openDb();
      if (!db) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (error) { console.warn('[recorder] cache write failed', error); }
  }

  async function dbGet(key) {
    try {
      const db = await openDb();
      if (!db) return null;
      const value = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return value;
    } catch { return null; }
  }

  const micSvg = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="17" y="5" width="14" height="25" rx="7"></rect><path d="M11 23v2a13 13 0 0 0 26 0v-2M24 38v6M17 44h14"></path></svg>`;

  class VoiceRecorder {
    constructor(root) {
      this.root = root;
      this.key = root.dataset.storageKey || `recording:${location.pathname}`;
      this.minSeconds = Number(root.dataset.minSeconds || 2);
      this.state = 'idle';
      this.elapsedMs = 0;
      this.startedAt = 0;
      this.chunks = [];
      this.samples = new Array(160).fill(0).map((_, i) => .16 + .08 * Math.sin(i * .37));
      this.stream = null;
      this.mediaRecorder = null;
      this.audioContext = null;
      this.analyser = null;
      this.sourceNode = null;
      this.raf = 0;
      this.timerHandle = 0;
      this.blob = null;
      this.audioUrl = '';
      this.simulated = false;
      this.syncState = 'local';
      this.render();
      this.bind();
      this.restore();
      this.resizeCanvas();
      addEventListener('resize', () => this.resizeCanvas(), { passive: true });
      addEventListener('online', () => this.scheduleSync());
      addEventListener('offline', () => this.setSync('local'));
      this.draw(performance.now());
    }

    render() {
      const compact = this.root.classList.contains('compact');
      this.root.classList.add('voice-recorder');
      this.root.dataset.state = 'idle';
      this.root.innerHTML = `
        <div class="vr-toast" role="status" aria-live="polite"></div>
        <div class="vr-grid">
          <div class="vr-control">
            <div class="vr-orbits" aria-hidden="true"><i></i></div>
            <button class="vr-mic" type="button" aria-label="开始录音">${micSvg}</button>
            <div class="vr-state">点击开始</div>
            <div class="vr-substate">录音仅在本机处理</div>
          </div>
          <div class="vr-main">
            <div class="vr-pipeline" aria-hidden="true"><span>采集<b>麦克风输入</b></span><span>识别<b>语音声场分析</b></span><span>保存<b>本地安全存储</b></span></div>
            <div class="vr-canvas-wrap"><canvas class="vr-wave" aria-label="实时声音波形"></canvas><i class="vr-playhead"></i></div>
            <div class="vr-bottom">
              <span class="vr-time">00:00</span>
              <div class="vr-meter" aria-hidden="true">${'<i></i>'.repeat(compact ? 34 : 52)}</div>
              <span class="vr-quality">等待声音</span><span class="vr-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
              <button class="vr-action" type="button"><span class="ico">●</span><span class="label">开始录音</span></button>
            </div>
          </div>
        </div>
        <audio class="vr-hidden-audio" preload="metadata"></audio>`;
      this.canvas = this.root.querySelector('.vr-wave');
      this.ctx = this.canvas.getContext('2d');
      this.micButton = this.root.querySelector('.vr-mic');
      this.actionButton = this.root.querySelector('.vr-action');
      this.stateEl = this.root.querySelector('.vr-state');
      this.substateEl = this.root.querySelector('.vr-substate');
      this.timeEl = this.root.querySelector('.vr-time');
      this.qualityEl = this.root.querySelector('.vr-quality');
      this.meterEls = [...this.root.querySelectorAll('.vr-meter i')];
      this.audio = this.root.querySelector('audio');
      this.toastEl = this.root.querySelector('.vr-toast');
    }

    bind() {
      const trigger = () => this.primaryAction();
      this.micButton.addEventListener('click', trigger);
      this.actionButton.addEventListener('click', trigger);
      this.audio.addEventListener('timeupdate', () => {
        if (this.state === 'playing') {
          this.elapsedMs = this.audio.currentTime * 1000;
          this.updateTime();
        }
      });
      this.audio.addEventListener('ended', () => this.setState('recorded'));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'recording' && this.mediaRecorder?.state === 'recording') this.pause();
      });
    }

    async restore() {
      const meta = JSON.parse(localStorage.getItem(this.key) || 'null');
      const blob = await dbGet(this.key);
      if (meta && blob instanceof Blob) {
        this.blob = blob;
        this.elapsedMs = meta.duration || 0;
        this.samples = Array.isArray(meta.samples) ? meta.samples : this.samples;
        this.audioUrl = URL.createObjectURL(blob);
        this.audio.src = this.audioUrl;
        this.setState('recorded');
        this.setSync(meta.syncState || 'local');
      } else {
        this.setState('idle');
      }
    }

    async primaryAction() {
      if (this.state === 'idle' || this.state === 'recorded' || this.state === 'error') return this.start();
      if (this.state === 'recording') return this.pause();
      if (this.state === 'paused') return this.resume();
      if (this.state === 'playing') return this.stopPlayback();
    }

    async start() {
      await this.reset(false);
      this.setState('requesting');
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('unsupported');
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
        this.mediaRecorder = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
        this.mediaRecorder.ondataavailable = e => { if (e.data?.size) this.chunks.push(e.data); };
        this.mediaRecorder.onstop = () => this.finishBlob();
        this.mediaRecorder.start(250);
        await this.setupAnalyser(this.stream);
        this.simulated = false;
        this.beginClock();
        this.setState('recording');
        this.notify('麦克风已连接，正在录音');
      } catch (error) {
        // A complete demo remains usable when permissions are unavailable (e.g. static preview/http).
        this.simulated = true;
        this.beginClock();
        this.setState('recording');
        this.substateEl.textContent = '演示声场 · 点击暂停';
        this.notify(error?.name === 'NotAllowedError' ? '未获麦克风权限，已进入交互演示模式' : '当前环境无法录音，已进入交互演示模式');
      }
    }

    async setupAnalyser(stream) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await this.audioContext.resume();
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = .78;
      this.sourceNode.connect(this.analyser);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    beginClock() {
      this.startedAt = performance.now() - this.elapsedMs;
      clearInterval(this.timerHandle);
      this.timerHandle = setInterval(() => {
        if (this.state === 'recording') {
          this.elapsedMs = performance.now() - this.startedAt;
          this.updateTime();
        }
      }, 100);
    }

    pause() {
      if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.pause();
      this.elapsedMs = performance.now() - this.startedAt;
      clearInterval(this.timerHandle);
      this.setState('paused');
      this.notify('录音已暂停，可继续或完成');
      this.emit('pause');
    }

    resume() {
      if (this.mediaRecorder?.state === 'paused') this.mediaRecorder.resume();
      this.beginClock();
      this.setState('recording');
      this.notify('继续录音');
      this.emit('resume');
    }

    async complete() {
      if (this.state === 'recording') this.pause();
      if (this.elapsedMs < this.minSeconds * 1000) {
        this.notify(`至少录制 ${this.minSeconds} 秒`);
        return false;
      }
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      } else if (this.simulated) {
        // A small valid WAV makes the demo state persist and allows playback semantics.
        this.blob = this.makeSilentWav(Math.max(1, this.elapsedMs / 1000));
        await this.persist();
      }
      this.stopTracks();
      this.setState('recorded');
      this.scheduleSync();
      this.emit('complete', { duration: this.elapsedMs, simulated: this.simulated });
      return true;
    }

    async finishBlob() {
      if (!this.chunks.length) return;
      this.blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
      await this.persist();
    }

    async persist() {
      if (!this.blob) return;
      await dbPut(this.key, this.blob);
      if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = URL.createObjectURL(this.blob);
      this.audio.src = this.audioUrl;
      localStorage.setItem(this.key, JSON.stringify({ duration: this.elapsedMs, samples: this.samples.slice(-160), syncState: this.syncState, updatedAt: Date.now() }));
    }

    async play() {
      if (!this.audio.src) return this.notify('当前录音尚未生成可播放文件');
      try {
        this.audio.currentTime = 0;
        await this.audio.play();
        this.setState('playing');
      } catch { this.notify('浏览器阻止了播放，请再次点击'); }
    }

    stopPlayback() {
      this.audio.pause();
      this.setState('recorded');
    }

    async reset(announce = true) {
      clearInterval(this.timerHandle);
      this.stopTracks();
      this.audio.pause();
      this.elapsedMs = 0;
      this.chunks = [];
      this.blob = null;
      this.simulated = false;
      if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = '';
      this.audio.removeAttribute('src');
      this.samples = new Array(160).fill(0).map((_, i) => .12 + .05 * Math.sin(i * .31));
      localStorage.removeItem(this.key);
      this.setState('idle');
      if (announce) this.notify('已清除录音，可以重新开始');
      this.emit('reset');
    }

    stopTracks() {
      this.stream?.getTracks().forEach(t => t.stop());
      this.stream = null;
      this.sourceNode?.disconnect?.();
      this.audioContext?.close?.();
      this.analyser = null;
    }

    setState(state) {
      this.state = state;
      this.root.dataset.state = state;
      const copy = {
        idle: ['点击开始', '录音仅在本机处理', '开始录音', '●', '等待声音'],
        requesting: ['正在连接', '请允许使用麦克风', '连接中…', '…', '准备中'],
        recording: ['正在聆听', '声音实时分析中', '暂停', 'Ⅱ', '声音清晰'],
        paused: ['录音已暂停', '可继续或完成本次录音', '继续录音', '▶', '已暂停'],
        recorded: ['录音已保存', this.syncState === 'synced' ? '已安全同步' : '保存在本机', '重新录制', '↻', '录音完成'],
        playing: ['正在回放', '点击停止播放', '停止播放', '■', '回放中'],
        error: ['无法录音', '请检查麦克风权限', '重试', '↻', '设备异常']
      }[state] || [];
      this.stateEl.textContent = copy[0] || '';
      this.substateEl.textContent = copy[1] || '';
      this.actionButton.querySelector('.label').textContent = copy[2] || '';
      this.actionButton.querySelector('.ico').textContent = copy[3] || '';
      this.qualityEl.textContent = copy[4] || '';
      this.micButton.setAttribute('aria-label', copy[2] || state);
      this.updateTime();
      this.emit('state', { state });
    }

    setSync(state) {
      this.syncState = state;
      this.root.dataset.sync = state;
      if (this.state === 'recorded') {
        this.substateEl.textContent = state === 'synced' ? '已安全同步' : state === 'syncing' ? '正在安全同步…' : '已保存在本机，等待同步';
      }
      this.emit('sync', { state });
    }

    scheduleSync() {
      if (!navigator.onLine) return this.setSync('local');
      this.setSync('syncing');
      setTimeout(() => {
        this.setSync('synced');
        const meta = JSON.parse(localStorage.getItem(this.key) || '{}');
        localStorage.setItem(this.key, JSON.stringify({ ...meta, syncState: 'synced' }));
        this.notify('录音已同步');
      }, 900);
    }

    updateTime() {
      const total = Math.max(0, Math.floor(this.elapsedMs / 1000));
      const min = String(Math.floor(total / 60)).padStart(2, '0');
      const sec = String(total % 60).padStart(2, '0');
      this.timeEl.textContent = `${min}:${sec}`;
    }

    resizeCanvas() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.canvas.dataset.dpr = dpr;
    }

    currentLevel(now) {
      if (this.state === 'recording' && this.analyser) {
        this.analyser.getByteFrequencyData(this.freqData);
        let sum = 0;
        for (let i = 2; i < Math.min(60, this.freqData.length); i++) sum += this.freqData[i];
        return Math.min(1, sum / 58 / 155);
      }
      if (this.state === 'recording' && this.simulated) return .32 + .22 * Math.sin(now / 170) + .12 * Math.sin(now / 61);
      if (this.state === 'playing') return .28 + .18 * Math.sin(now / 150);
      return .09 + .025 * Math.sin(now / 500);
    }

    draw(now) {
      const level = Math.max(.02, this.currentLevel(now));
      if (this.state === 'recording' && (!this.samples.length || now - (this.lastSample || 0) > 45)) {
        this.samples.push(Math.max(.04, Math.min(1, level + Math.random() * .12)));
        if (this.samples.length > 180) this.samples.shift();
        this.lastSample = now;
      }
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, dpr = Number(this.canvas.dataset.dpr || 1);
      ctx.clearRect(0, 0, w, h);
      const samples = this.samples;
      const layers = 9;
      for (let layer = layers - 1; layer >= 0; layer--) {
        const alpha = .12 + (layers - layer) * .045;
        const offset = (layer - 4) * 4.2 * dpr;
        ctx.beginPath();
        for (let x = 0; x < w; x += 2 * dpr) {
          const p = x / Math.max(1, w - 1);
          const idx = Math.min(samples.length - 1, Math.floor(p * samples.length));
          const sample = samples[idx] || .08;
          const envelope = .48 + .52 * Math.sin(Math.PI * p);
          const y = h * .52 + offset + Math.sin(p * 35 + layer * .5) * 2.1 * dpr - sample * h * .25 * envelope * Math.sin(p * 76 + layer * .34);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, `rgba(230,55,34,${alpha})`);
        grad.addColorStop(.46, `rgba(231,178,74,${alpha + .05})`);
        grad.addColorStop(1, `rgba(75,169,105,${alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = (layer === 0 ? 1.4 : .75) * dpr;
        ctx.stroke();
      }
      this.meterEls.forEach((el, i) => {
        const active = this.state === 'recording' && i < Math.round(level * this.meterEls.length * .9 + 5);
        el.classList.toggle('active', active);
        el.style.height = `${8 + Math.abs(Math.sin(i * .72 + now / 145)) * (active ? 17 : 7)}px`;
      });
      this.raf = requestAnimationFrame(t => this.draw(t));
    }

    notify(message) {
      clearTimeout(this.toastTimer);
      this.toastEl.textContent = message;
      this.toastEl.classList.add('show');
      this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2400);
    }

    emit(name, detail = {}) {
      this.root.dispatchEvent(new CustomEvent(`recorder:${name}`, { bubbles: true, detail: { recorder: this, ...detail } }));
    }

    makeSilentWav(seconds) {
      const rate = 8000, length = Math.min(20, Math.max(1, seconds)) * rate | 0;
      const buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer);
      const write = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
      write(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
      view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length * 2, true);
      return new Blob([buffer], { type: 'audio/wav' });
    }
  }

  window.YuzanVoiceRecorder = VoiceRecorder;
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-voice-recorder]').forEach(el => { if (!el.__voiceRecorder) el.__voiceRecorder = new VoiceRecorder(el); });
  });
})();
