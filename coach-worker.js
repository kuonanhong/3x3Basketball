/* Pinned local Transformers.js + ONNX Runtime. Runs on the visitor's CPU, never a hosted API. */
const ASSET_BASE = new URL('./', import.meta.url);
const MODEL_BASE = new URL('models/qwen2.5-0.5b/', ASSET_BASE);
const MODEL_FILE = new URL('onnx/model_quantized.onnx', MODEL_BASE).href;
const CACHE = 'smartaction-coach-qwen25-22942cb7-v1';
const rawFetch = self.fetch.bind(self);
let generator, library, busy = false, currentId = 0, manifest;
function progress(value) { self.postMessage({type: 'progress', progress: value}); }
function hex(buffer) { return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join(''); }
async function cachedFetch(url) {
  let cache;
  try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) return hit; } catch (_) {}
  const response = await rawFetch(url);
  if (!response.ok) throw new Error(`Asset unavailable (${response.status}): ${new URL(url).pathname.split('/').pop()}`);
  if (cache) { try { await cache.put(url, response.clone()); } catch (_) { /* Full/quota-limited caches do not prevent inference. */ } }
  return response;
}
async function splitModelResponse() {
  if (!manifest) manifest = await (await cachedFetch(`${MODEL_FILE}.parts.json`)).json();
  if (!Array.isArray(manifest.pieces) || manifest.bytes !== 512096557 || !manifest.pieces.length) throw new Error('Invalid model split manifest.');
  let count = 0, loaded = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        if (count >= manifest.pieces.length) {
          if (loaded !== manifest.bytes) throw new Error('Model total byte length mismatch.');
          controller.close(); return;
        }
        const part = manifest.pieces[count];
        if (part.name !== `model_quantized.onnx.part${String(count).padStart(3, '0')}` || part.bytes > 40*1024*1024) throw new Error('Invalid model part path/size.');
        const url = new URL(part.name, MODEL_FILE).href;
        const response = await cachedFetch(url);
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength !== part.bytes || hex(await crypto.subtle.digest('SHA-256', buffer)) !== part.sha256) {
          try { (await caches.open(CACHE)).delete(url); } catch (_) {}
          throw new Error(`Model integrity check failed: ${part.name}. Reload the model.`);
        }
        loaded += buffer.byteLength; count += 1;
        progress({status: 'weights', loaded, total: manifest.bytes, progress: loaded / manifest.bytes * 100, file: part.name});
        controller.enqueue(new Uint8Array(buffer));
      } catch (e) { controller.error(e); }
    }
  });
  return new Response(stream, {headers: {'Content-Type': 'application/octet-stream', 'Content-Length': String(manifest.bytes)}});
}
self.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, ASSET_BASE).href;
  if (url === MODEL_FILE) return splitModelResponse();
  if (url.startsWith(MODEL_BASE.href)) return cachedFetch(url);
  return rawFetch(input, init);
};
async function load() {
  if (generator) return;
  progress({status:'runtime', progress:0});
  library ||= await import('./vendor/transformers/transformers.min.js');
  const {env, pipeline} = library;
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = new URL('models/', ASSET_BASE).href;
  env.useBrowserCache = false;
  env.backends.onnx.wasm.wasmPaths = new URL('vendor/transformers/', ASSET_BASE).href;
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
  generator = await pipeline('text-generation', 'qwen2.5-0.5b', {
    dtype: 'q8', device: 'wasm', local_files_only: true,
    progress_callback: item => { if (item.status !== 'progress' || !item.file?.endsWith('.onnx')) progress(item); },
  });
  generator.tokenizer.model_max_length = 768;
  progress({status:'ready',progress:100});
}
const SPORT_NOTES = {
  basketball: ['Keep the dribble close, look up at teammates and defenders, practice both hands, and pass to an open teammate before forcing a shot.', '運球時抬頭觀察隊友與防守位置、保持球靠近身體、練習雙手換手，先慢再快。有空檔再傳球或投籃。'],
  soccer5: ['Use short touches, create passing triangles, and look for an open passing lane.', '小幅觸球控制方向、與隊友保持傳球角度，先找空檔再射門。'],
  baseball: ['Track the incoming ball, coordinate foot position with torso rotation, then time the swing.', '觀察來球，先調整腳步與身體轉向，再掌握揮棒時機。'],
  badminton: ['Recover toward the middle after each stroke and aim away from the opponent.', '擊球後回到較中央位置，觀察對手位置，再選擇落點。'],
  tabletennis: ['Use compact strokes, watch the bounce, and recover after each return.', '使用短而穩定的揮拍，觀察彈跳，回球後回到準備位置。'],
  tennis: ['Move into position before the bounce and recover after striking.', '先移動到位，再選擇擊球方向；擊球後回到準備位置。'],
  'american-football': ['Look for open running lanes and pass before the defender closes in.', '觀察可前進的空間，在防守者靠近前選擇傳球或改變方向。'],
  'ice-hockey': ['Keep control of the puck, use passing lanes, and aim before shooting.', '先控制冰球、觀察傳球路線，瞄準後再射門。'],
  rugby: ['Keep support players nearby and pass backward before a defender closes in.', '注意支援隊友的位置，在防守逼近前向後傳球。'],
  volleyball: ['Move under the ball early, then choose a controlled return over the net.', '提早移動到球的落點附近，再控制回球方向越過球網。'],
  handball: ['Create space with short passes and aim at an open part of the goal.', '利用短傳製造空間，觀察球門空檔後再射門。'],
  sprint: ['Use a consistent input rhythm and avoid changing direction unnecessarily.', '保持穩定的操作節奏，減少不必要的方向變換。'],
  archery: ['Steady the aim, account for the selected wind, and release consistently.', '先穩定瞄準方向，留意所選風向，再掌握一致的放箭時機。']
};
function systemPrompt(context) {
  const lang = context.language || 'en';
  const isChinese = /^zh/i.test(lang);
  const sport = context.sport.replace(/-doubles$/, '');
  const notes = SPORT_NOTES[sport] || ['Start slowly, observe the target, then increase difficulty gradually.', '先慢速練習、觀察目標，再逐步提高難度。'];
  if (isChinese) {
    const writing = /Hans|CN|SG/i.test(lang) ? '簡體中文' : '繁體中文';
    return `你是聰動運動遊戲教練。只用${writing}回答，給兩項簡短建議。依據參考資料回答，不編造球員官方數據、不提供醫療診斷，不確定時直接說明。運動：${context.sport}；遊戲難度：${context.level}。參考資料：${notes[1]} 遊戲角色資料：${context.player}；對手：${context.opponent}。`;
  }
  return `You are SmartAction, a friendly sports GAME coach. Reply in language ${lang} with 2 short practical tips. Sport: ${context.sport}; difficulty: ${context.level}. Reference notes: ${notes[0]} Never invent official athlete ratings, diagnose injuries, or claim live statistics. Say when uncertain. Game player: ${context.player}. Opponent: ${context.opponent}.`;
}
async function ask(question, context) {
  if (!generator) throw new Error('MODEL_NOT_READY');
  const messages = [
    {role: 'system', content: systemPrompt(context)},
    {role: 'user', content: question}
  ];
  // Count the fully rendered chat prompt without truncation before any ONNX call.
  const promptIds = generator.tokenizer.apply_chat_template(messages, {
    tokenize: true, add_generation_prompt: true, padding: false,
    truncation: false, return_tensor: false, return_dict: false,
  });
  if (!Array.isArray(promptIds)) throw new Error('TOKEN_COUNT_UNAVAILABLE');
  if (promptIds.length > 768) {
    const message = /^zh/i.test(context.language || '')
      ? `輸入連同教練背景共 ${promptIds.length} token，超過 768 上限；請縮短問題。`
      : `Input plus coach context contains ${promptIds.length} tokens (limit 768). Please shorten your question.`;
    throw new Error(`INPUT_TOO_LONG: ${message}`);
  }
  const streamer = new library.TextStreamer(generator.tokenizer, {skip_prompt: true, skip_special_tokens: true, callback_function: text => self.postMessage({type:'token',id:currentId,text})});
  const output = await generator(messages, {
    max_new_tokens: 128, do_sample: false, repetition_penalty: 1.15, no_repeat_ngram_size: 3,
    streamer,
  });
  const text = output?.[0]?.generated_text;
  return Array.isArray(text) ? String(text.at(-1)?.content || '') : String(text || '');
}
self.onmessage = async ({data}) => {
  const {id,type} = data;
  if (busy) { self.postMessage({type:'error',id,error:'MODEL_BUSY'}); return; }
  busy = true; currentId = id;
  try {
    let result;
    if (type === 'load') { await load(); result = {ready:true,device:'wasm',threads:1,dtype:'q8'}; }
    else if (type === 'ask') result = await ask(data.question, data.context);
    else throw new Error('UNKNOWN_COMMAND');
    self.postMessage({type:'done',id,result});
  } catch (e) {
    const message = String(e?.message || e);
    self.postMessage({type:'error',id,error:message,recoverable:message.startsWith('INPUT_TOO_LONG:')});
  }
  finally { busy = false; }
};
