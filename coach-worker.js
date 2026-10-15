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
  basketball5: ['Full court: run the lanes on the break, space the floor, and attack the far hoop with the shot clock in mind.', '全場五對五：快攻時跑開三條路線、拉開空間，注意進攻時間再往對面籃框進攻。'],
  soccer5: ['Use short touches, create passing triangles, and look for an open passing lane.', '小幅觸球控制方向、與隊友保持傳球角度，先找空檔再射門。'],
  baseball: ['Track the pitch early, move the bat contact point to the ball, load while it travels and swing when it crosses the plate; early contact pulls, late contact goes the other way.', '提早判斷球路，把球棒擊球點移到來球位置，球飛行時先按住準備、過本壘時放開揮棒；太早會拉打、太晚會推打。'],
  softball: ['Underhand pitches rise or drop late; keep the bat level, wait for the ball to reach the plate, and favour contact swings on rise balls.', '下手投球會在後段上飄或下墜；球棒保持水平，等球到本壘再揮，面對上飄球多用穩定揮棒。'],
  cricket: ['Read the length off the bounce: step forward to full deliveries, back to short ones, keep the bat straight and protect the stumps before chasing boundaries.', '從彈跳判斷長度：長球前跨步、短球後退，球棒保持垂直，先守住三柱門再追求邊界。'],
  badminton: ['Recover toward the middle after each stroke and aim away from the opponent.', '擊球後回到較中央位置，觀察對手位置，再選擇落點。'],
  tabletennis: ['Use compact strokes, watch the bounce, and recover after each return.', '使用短而穩定的揮拍，觀察彈跳，回球後回到準備位置。'],
  tennis: ['Move into position before the bounce and recover after striking.', '先移動到位，再選擇擊球方向；擊球後回到準備位置。'],
  'soft-tennis': ['The soft ball bounces high and slow: take it on the rise, use the lob to reset and cover the court with your partner.', '軟式球彈得高且慢：在球上升時擊球，用高吊球重整節奏，並與搭檔分工守住場地。'],
  'american-football': ['Look for open running lanes and pass before the defender closes in.', '觀察可前進的空間，在防守者靠近前選擇傳球或改變方向。'],
  'flag-football': ['Non-contact: change direction early, keep the flags away from defenders and pass quickly to open teammates.', '無碰撞規則：提早變向、讓腰旗遠離防守者，快速傳給空檔隊友。'],
  'ice-hockey': ['Keep control of the puck, use passing lanes, and aim before shooting.', '先控制冰球、觀察傳球路線，瞄準後再射門。'],
  'field-hockey': ['Keep the ball on the stick, shoot low from inside the circle and pass before the defender tackles.', '球貼著球桿帶球，在射門弧內低射，防守者搶球前先傳球。'],
  rugby: ['Keep support players nearby and pass backward before a defender closes in.', '注意支援隊友的位置，在防守逼近前向後傳球。'],
  volleyball: ['Move under the ball early, then choose a controlled return over the net.', '提早移動到球的落點附近，再控制回球方向越過球網。'],
  'beach-volleyball': ['Two players cover the whole sand court: communicate, move early under the ball and use the lob when the attack is covered.', '兩人要守住整片沙地：提早溝通、移到球下方，扣球被防住時改用輕吊。'],
  'sepak-takraw': ['Watch the ball off the net, get under it with balance and use a controlled lift before the kick over the net.', '盯緊過網的球，保持平衡移到球下方，先控制托球再踢球過網。'],
  handball: ['Create space with short passes and aim at an open part of the goal.', '利用短傳製造空間，觀察球門空檔後再射門。'],
  'water-polo': ['Players move slowly in water: pass early, keep the ball above the surface and throw at the small goal when the keeper is off line.', '水中移動慢：提早傳球，把球舉在水面上，守門員偏離時再擲向小球門。'],
  lacrosse: ['Cradle the ball, keep moving, pass quickly and shoot at the corners of the small goal.', '持續兜球與移動，快速傳導，瞄準小球門的角落射門。'],
  squash: ['Hit above the tin, return to the T after each shot and vary height to move the opponent.', '擊球高於底板，每次回擊後回到 T 字位置，用高低變化調動對手。'],
  golf: ['Check the wind, choose power by distance (putt on the green), aim slightly against the wind and keep the swing smooth.', '先看風向，依距離決定力道（果嶺上推桿），略為逆風瞄準，揮桿保持平順。'],
  bowling: ['Aim between the arrows, add a little hook so the ball enters the pocket at an angle and keep the speed consistent.', '瞄準箭頭之間，加一點曲球讓球以角度進入 1-3 瓶口袋，保持穩定球速。'],
  billiards: ['Plan the pocket first, aim the cue ball at the ghost-ball position, use less power for accuracy and avoid scratching.', '先選好球袋，瞄準母球到虛擬球位置，小力更準確，避免母球落袋。'],
  sprint: ['Use a consistent input rhythm and avoid changing direction unnecessarily.', '保持穩定的操作節奏，減少不必要的方向變換。'],
  archery: ['Steady the aim, account for the selected wind, and release consistently.', '先穩定瞄準方向，留意所選風向，再掌握一致的放箭時機。']
};
function systemPrompt(context) {
  const lang = context.language || 'en';
  const isChinese = /^zh/i.test(lang);
  const sport = context.sport.replace(/-doubles$/, '');
  const notes = SPORT_NOTES[sport] || ['Start slowly, observe the target, then increase difficulty gradually.', '先慢速練習、觀察目標，再逐步提高難度。'];
  const sportName = context.sportName || context.sport, rule = context.rule ? ` ${context.rule}` : '';
  const metrics = context.metrics ? ` Session numbers: ${context.metrics}.` : '';
  if (isChinese) {
    const writing = /Hans|CN|SG/i.test(lang) ? '簡體中文' : '繁體中文';
    return `你是聰動運動遊戲的教練，正在回答學徒（初學者）的問題。只用${writing}回答，給兩項簡短、可立即練習的建議。依據參考資料回答，不編造球員官方數據、不提供醫療診斷，不確定時直接說明。運動：${sportName}；遊戲難度：${context.level}。本模式規則：${rule} 參考資料：${notes[1]}${metrics} 遊戲角色資料：${context.player}；對手：${context.opponent}。`;
  }
  return `You are SmartAction, a friendly sports GAME coach answering an apprentice (beginner). Reply in language ${lang} with 2 short practical tips they can try right now. Sport: ${sportName}; difficulty: ${context.level}. Mode rules:${rule} Reference notes: ${notes[0]}${metrics} Never invent official athlete ratings, diagnose injuries, or claim live statistics. Say when uncertain. Game player: ${context.player}. Opponent: ${context.opponent}.`;
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
