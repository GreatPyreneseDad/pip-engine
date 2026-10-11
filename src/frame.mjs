/* pip-engine · frame builder. Assembles the sealed game document: lib + runtime + game source + loop.
   Pure string work, no DOM: usable in the browser host, in Node tests, or in an edge function. */

const SO = '<' + 'script>', SC = '<' + '/script>';

/** Encode game source so it cannot break out of its <script> element. */
export function encodeSource(src) {
  return JSON.stringify(String(src))
    .replace(/<\//g, '<\\/')
    .replace(new RegExp('<' + '!--', 'g'), '<\\!--')
    .replace(/\u2028|\u2029/g, ' ');
}

/**
 * Build the iframe srcdoc for one game.
 * @param {{lib: string, runtime: string, loop: string}} engine  engine sources (see dist/pip-engine.mjs)
 * @param {{pre?: string, code: string}} game  pre = reusable parts, code = the game
 */
export function frameDoc(engine, game) {
  const src = encodeSource((game.pre || '') + '\n;\n' + game.code);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'"><style>html,body{margin:0;height:100%;overflow:hidden;background:#2a1f5c;touch-action:none;user-select:none;-webkit-user-select:none}canvas{display:block;width:100%;height:100%;touch-action:none}</style></head><body><canvas id="c"></canvas>
${SO}window.onerror=function(m,s,l){try{parent.postMessage({gm:1,type:'error',message:String(m),frames:-1},'*')}catch(e){}return true};${SC}
${SO}${engine.lib}${SC}${SO}${engine.runtime}${SC}
${SO}var __SRC = ${src};${SC}
${SO}${engine.loop}${SC}</body></html>`;
}
