#!/usr/bin/env python3
"""Rebuild standalone HTML, translated entry pages, guide and SW using Python stdlib."""
from pathlib import Path
import argparse, hashlib, html, json, re
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='https://kuonanhong.github.io/SmartAction/動手動腦/3x3-basketball/')
args = parser.parse_args()
BASE = args.base_url.rstrip('/') + '/'
template = (ROOT/'index.html').read_text(encoding='utf-8')
source = (ROOT/'locales.js').read_text(encoding='utf-8')
data = json.JSONDecoder().raw_decode(source.split('root.SAHoopsI18n =',1)[1].lstrip())[0]

def inline(text):
    text = html.escape(text)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    text = re.sub(r'&lt;(https?://[^\s]+?)&gt;', r'<a href="\1" rel="noopener noreferrer">\1</a>', text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    return text

def markdown(text):
    out=[]; lines=text.splitlines(); i=0
    while i<len(lines):
        line=lines[i]
        if line.startswith('```'):
            block=[]; i+=1
            while i<len(lines) and not lines[i].startswith('```'):
                block.append(lines[i]); i+=1
            out.append('<pre><code>'+html.escape('\n'.join(block))+'</code></pre>')
        elif line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].startswith('|'):
                cells=[x.strip() for x in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', x) for x in cells): rows.append(cells)
                i+=1
            out.append('<div class="table-wrap"><table>')
            for n,row in enumerate(rows):
                tag='th' if n==0 else 'td'
                out.append('<tr>'+''.join('<'+tag+'>'+inline(x)+'</'+tag+'>' for x in row)+'</tr>')
            out.append('</table></div>'); continue
        elif re.match(r'^#{1,6} ',line):
            n=len(line.split(' ',1)[0]); out.append(f'<h{n}>'+inline(line[n+1:])+f'</h{n}>')
        elif line.strip(): out.append('<p>'+inline(line)+'</p>')
        i+=1
    return '\n'.join(out)

sections=[]
for filename,label in [('GAME_IDEAS.md','20 個遊戲構想'),('DEPLOY_GITHUB.md','GitHub 部署教學'),('SCALE_AND_MAPS.md','容量、效能與地圖')]:
    text=(ROOT/'docs'/filename).read_text(encoding='utf-8')
    sections.append('<section id="'+filename.split('.')[0]+'">'+markdown(text)+'</section>')
guide='''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>聰動街籃：操作與部署教學</title><style>body{font:16px/1.8 system-ui,sans-serif;color:#243c40;background:#f1f5ec;max-width:1040px;margin:30px auto;padding:0 24px 60px}nav{position:sticky;top:0;background:#f1f5ecee;padding:12px 0;display:flex;gap:18px;flex-wrap:wrap}a{color:#296e65}h1{font-size:30px}h2{margin-top:30px}section{padding:20px 0;border-top:1px solid #afc1b1}pre{background:#192f38;color:#eaf3dc;padding:20px;overflow:auto;border-radius:8px;font-size:13px;line-height:1.6}code{font-family:monospace;overflow-wrap:anywhere}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:10px;border:1px solid #b7c8b9;text-align:left}th{background:#d6e6ce}p{overflow-wrap:anywhere}</style><nav><a href="./">← 回到遊戲</a><a href="#GAME_IDEAS">20 個遊戲構想</a><a href="#DEPLOY_GITHUB">部署教學</a><a href="#SCALE_AND_MAPS">容量與地圖</a></nav>'''+''.join(sections)+'</html>'
(ROOT/'guide.html').write_text(guide,encoding='utf-8')

# True static, readable translated entries; the runtime still shares one asset set.
alternates='\n'.join('<link rel="alternate" hreflang="'+x['code']+'" href="'+html.escape(BASE+'lang/'+x['code']+'/',quote=True)+'">' for x in data['languages'])
alternates+='\n<link rel="alternate" hreflang="x-default" href="'+html.escape(BASE,quote=True)+'">'
for entry in data['languages']:
    code=entry['code']; messages=data['messages'][code]
    translated=re.sub(r'<html lang="[^"]+">', '<html lang="'+code+'" dir="'+entry['dir']+'" data-default-lang="'+code+'">',template,count=1)
    def translate(match):
        return match.group(1)+html.escape(messages.get(match.group(3),match.group(4)))+match.group(5)
    translated=re.sub(r'(<([a-z0-9]+)\b[^>]*data-i18n="([^"]+)"[^>]*>)([^<]*)(</\2>)',translate,translated)
    translated=re.sub(r'<title>.*?</title>','<title>'+html.escape(messages['title'])+' · SmartAction Court</title>',translated)
    translated=re.sub(r'<meta name="description" content="[^"]*">','<meta name="description" content="'+html.escape(messages['subtitle']+' '+messages['localMode']+' '+messages['keyboardHelp'],quote=True)+'">',translated)
    translated=re.sub(r'<link rel="canonical" href="[^"]+">','<link rel="canonical" href="'+html.escape(BASE+'lang/'+code+'/',quote=True)+'">\n'+alternates,translated)
    for filename in ['styles.css','icon.svg','manifest.webmanifest','locales.js','game-core.js','renderer.js','app.js','guide.html']:
        translated=translated.replace('="'+filename+'"','="../../'+filename+'"')
    directory=ROOT/'lang'/code; directory.mkdir(parents=True,exist_ok=True)
    (directory/'index.html').write_text(translated,encoding='utf-8')

css=(ROOT/'styles.css').read_text(encoding='utf-8')
standalone=template.replace('<link rel="stylesheet" href="styles.css">','<style>'+css.replace('</style','<\\/style')+'</style>')
standalone=re.sub(r'\s*<link rel="manifest"[^>]+>','',standalone)
icon=quote((ROOT/'icon.svg').read_text(encoding='utf-8'),safe='')
standalone=standalone.replace('href="icon.svg"','href="data:image/svg+xml,'+icon+'"')
guide_uri='data:text/html;charset=utf-8,'+quote(guide,safe='')
standalone=standalone.replace('href="guide.html" id="guideLink"','href="'+guide_uri+'" download="SmartAction_Guide.html" id="guideLink"')
for filename in ['locales.js','game-core.js','renderer.js','app.js']:
    content=(ROOT/filename).read_text(encoding='utf-8').replace('</script','<\\/script')
    standalone=standalone.replace('<script src="'+filename+'"></script>','<script>\n'+content+'\n</script>')
(ROOT/'SmartAction_3x3.html').write_text(standalone,encoding='utf-8')

runtime=['index.html','styles.css','locales.js','game-core.js','renderer.js','app.js','manifest.webmanifest','icon.svg','guide.html']
fingerprint=hashlib.sha256(b''.join((ROOT/f).read_bytes() for f in runtime)).hexdigest()[:16]
sw='''/* Generated by tools/build_standalone.py; only this game directory is cached. */
const CACHE = 'sa-hoops-'''+fingerprint+'''\';
const FILES = '''+json.dumps(runtime)+''';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('sa-hoops-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(event.request); if (hit) return hit;
    try { const response = await fetch(event.request); if (response.ok) await cache.put(event.request, response.clone()); return response; }
    catch(error) { if (event.request.mode === 'navigate') return (await cache.match(new URL('index.html', self.registration.scope).href)) || Response.error(); throw error; }
  }));
});
'''
(ROOT/'sw.js').write_text(sw,encoding='utf-8')
urls=[BASE]+[BASE+'lang/'+x['code']+'/' for x in data['languages']]
(ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join('<url><loc>'+html.escape(u)+'</loc></url>\n' for u in urls)+'</urlset>',encoding='utf-8')
print(json.dumps({'standalone_bytes':(ROOT/'SmartAction_3x3.html').stat().st_size,'runtime_bytes':sum((ROOT/f).stat().st_size for f in runtime)+(ROOT/'sw.js').stat().st_size,'language_entries':len(data['languages']),'cache':fingerprint},ensure_ascii=False))
