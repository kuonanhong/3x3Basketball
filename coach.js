/* SmartAction CPU coach controller. The model starts only after an explicit Load action. */
(() => {
  'use strict';
  const scriptURL = document.currentScript?.src || new URL('coach.js', document.baseURI).href;
  const workerURL = new URL('coach-worker.js', scriptURL);
  const modelName = 'Qwen2.5-0.5B-Instruct · q8 · CPU/WASM';
  let worker, sequence = 0, state = 'unloaded', error = '', callbacks = {}, progressCallback;
  const pending = new Map();
  function notify(next, detail = '') {
    state = next; error = next === 'error' ? detail : '';
    const value = api.status();
    callbacks.onState?.(value);
    window.dispatchEvent(new CustomEvent('sa-coach-state', {detail: value}));
  }
  function failAll(reason) {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error(reason)); }
    pending.clear();
  }
  function startWorker() {
    if (worker) return;
    if (!window.Worker || !window.WebAssembly) throw new Error('This browser does not support Workers + WebAssembly.');
    if (location.protocol === 'file:') throw new Error('Open this website through HTTPS or a local HTTP server.');
    worker = new Worker(workerURL, {type: 'module', name: 'SmartAction CPU coach'});
    worker.onmessage = ({data}) => {
      if (data.type === 'progress') { progressCallback?.(data.progress); callbacks.onProgress?.(data.progress); return; }
      const job = pending.get(data.id);
      if (data.type === 'token') { job?.onToken?.(data.text); return; }
      if (!job) return;
      clearTimeout(job.timer); pending.delete(data.id);
      if (data.type === 'error') {
        if (data.recoverable) notify('ready');
        else { worker?.terminate(); worker = null; notify('error', data.error); }
        job.reject(new Error(data.error));
      }
      else { notify('ready'); job.resolve(data.result); }
    };
    worker.onerror = (event) => {
      const message = event.message || 'The CPU model worker could not start.';
      failAll(message); worker?.terminate(); worker = null; notify('error', message);
    };
  }
  function request(type, payload = {}, timeout = 300000, onToken) {
    startWorker();
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        api.cancel(); notify('error', 'CPU model timed out. Try a shorter question or use the basic coach.');
      }, timeout);
      pending.set(id, {resolve, reject, timer, onToken});
      worker.postMessage({type, id, ...payload});
    });
  }
  const api = {
    init(options = {}) { callbacks = {...callbacks, ...options}; return api; },
    status() { return {state, model: modelName, bytes: 512096557, error, generative: state === 'ready' || state === 'generating'}; },
    async load({onProgress} = {}) {
      if (state === 'ready') return api.status();
      if (state === 'loading' || state === 'generating') throw new Error('The coach is already busy.');
      progressCallback = onProgress; notify('loading');
      try { await request('load', {}, 900000); return api.status(); }
      catch (e) { if (state !== 'unloaded' && !e.message.startsWith('INPUT_TOO_LONG:')) notify('error', e.message); throw e; }
    },
    async ask(text, options = {}) {
      if (state !== 'ready') throw new Error('MODEL_NOT_READY');
      const question = String(text || '').trim().slice(0, 900);
      if (!question) throw new Error('EMPTY_QUESTION');
      notify('generating');
      const context = {
        language: String(options.language || navigator.language || 'en').slice(0, 60),
        sport: String(options.sport || 'basketball').slice(0, 80),
        level: String(options.level || 'amateur').slice(0, 80),
        sportName: String(options.sportName || '').slice(0, 80),
        rule: String(options.rule || '').slice(0, 420),
        metrics: options.metrics ? JSON.stringify(Object.fromEntries(Object.entries(options.metrics).filter(([k, v]) => typeof v === 'number' && v !== 0 && ['hits', 'strikes', 'outs', 'runs', 'homeRuns', 'contactQuality', 'longestRally', 'strokes', 'pins', 'pocketed', 'lastRing'].includes(k)).map(([k, v]) => [k, Math.round(v * 100) / 100]))).slice(0, 200) : '',
        player: JSON.stringify(options.player || {}).slice(0, 320),
        opponent: JSON.stringify(options.opponent || {}).slice(0, 320),
      };
      try { return await request('ask', {question, context}, 300000, options.onToken); }
      catch (e) { if (state !== 'unloaded' && !e.message.startsWith('INPUT_TOO_LONG:')) notify('error', e.message); throw e; }
    },
    cancel() {
      worker?.terminate(); worker = null;
      failAll('CANCELLED'); notify('unloaded');
    },
    unload() { api.cancel(); },
    async clearCache() {
      api.unload();
      if ('caches' in window) for (const name of await caches.keys()) if (name.startsWith('smartaction-coach-')) await caches.delete(name);
    },
  };
  window.SACoach = api;
})();
