/* Páginas de entrada do Horus (login, criar acesso, recuperar). Uma só moldura para as três. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const OLHO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const ESTILO = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased;
background:radial-gradient(760px 420px at 50% -8%,rgba(237,161,0,.18),transparent 62%),var(--bg)}
.lg{width:min(380px,100%);text-align:center}
.lg .marca{margin:0 auto;position:relative;z-index:1;border-radius:26%;box-shadow:0 10px 28px rgba(0,0,0,.35)}
form{background:var(--surface);border-radius:var(--radius-lg);padding:60px 24px 24px;margin-top:-44px;box-shadow:var(--shadow);text-align:left}
h1{font-size:1.5rem;line-height:1.2;margin:0 0 6px;text-align:center;font-weight:700;letter-spacing:-.01em}
.sub{margin:0 0 18px;text-align:center;color:var(--ink-soft);font-size:.875rem;line-height:1.4}
label{display:block;font-size:.8125rem;font-weight:600;margin:12px 0 6px;color:var(--ink-soft)}
.campo{position:relative}
input{width:100%;height:52px;padding:0 50px 0 16px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2);color:var(--ink);font:inherit;font-size:1rem;outline:none;transition:border-color .15s,box-shadow .15s}
input:focus{border-color:var(--c-gold);box-shadow:0 0 0 3px rgba(237,161,0,.22)}
.olho{position:absolute;right:6px;top:6px;width:40px;height:40px;border:0;background:none;color:var(--ink-soft);border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.olho svg{width:22px;height:22px}
.olho:hover{color:var(--ink)}
button.entrar{width:100%;height:52px;margin-top:18px;border:0;border-radius:14px;background:var(--gold-btn);color:var(--gold-ink);font:inherit;font-size:1rem;font-weight:700;cursor:pointer;box-shadow:0 10px 24px rgba(201,133,0,.32);transition:transform .1s,filter .15s}
button.entrar:active{transform:scale(.99)}
button.entrar[disabled]{filter:grayscale(.3) brightness(.95);cursor:wait}
.erro{margin-top:14px;padding:10px 12px;border-radius:12px;background:rgba(220,47,47,.1);color:var(--urgente);font-size:.8125rem;font-weight:600;text-align:center}
.nota{margin-top:14px;color:var(--ink-soft);font-size:.78rem;line-height:1.45;text-align:center}
.lk{display:block;margin-top:14px;text-align:center;font-size:.8125rem;font-weight:700;color:var(--ink-soft)}
.rodape{margin-top:18px;color:var(--ink-soft);font-size:.75rem}
`;
/* opcoes: { titulo, sub, acao, campos:[{name,type,label,auto,valor,senha}], botao, ocupado, msg, nota, link:{href,txt} } */
export const pagina = (o) => `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#18181b"><title>Horus</title>
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=3"><link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png?v=3"><link rel="shortcut icon" href="/favicon.ico?v=3"><link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3"><link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/tema.css?v=1">
<style>${ESTILO}</style></head><body>
<main class="lg"><img class="marca" src="/logo/logo-dark.png?v=1" alt="Horus" width="96" height="96">
<form method="post" action="${esc(o.acao)}" id="f"><h1>${esc(o.titulo || 'Horus')}</h1><p class="sub">${esc(o.sub || '')}</p>
${(o.campos || []).map((c, i) => `<label for="c${i}">${esc(c.label)}</label><div class="campo"><input type="${c.senha ? 'password' : esc(c.type || 'text')}" name="${esc(c.name)}" id="c${i}" autocomplete="${esc(c.auto || 'off')}" value="${esc(c.valor || '')}"${c.senha ? ' minlength="1"' : ''}${c.ler ? ' readonly tabindex="-1" style="opacity:.75"' : ''}${!c.ler && !(o.campos || []).slice(0, i).some((x) => !x.ler) ? ' autofocus' : ''}${c.ler ? '' : ' required'}>${c.senha ? `<button type="button" class="olho" aria-label="Mostrar senha" data-o="c${i}">${OLHO}</button>` : ''}</div>`).join('')}
${o.semBotao ? '' : `<button type="submit" class="entrar" id="b" data-t="${esc(o.botao || 'Entrar')}">${esc(o.botao || 'Entrar')}</button>`}${o.msg ? `<div class="erro" role="alert">${esc(o.msg)}</div>` : ''}${o.nota ? `<div class="nota">${o.nota}</div>` : ''}${o.link ? `<a class="lk" href="${esc(o.link.href)}">${esc(o.link.txt)}</a>` : ''}</form>
<div class="rodape">Acesso restrito · seus dados ficam protegidos</div></main>
<script>
(function(){try{var t=localStorage.getItem('controlePeticoes.tema');if(t!=='light'&&t!=='dark'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)t='dark';document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){}})();
Array.prototype.forEach.call(document.querySelectorAll('.olho'),function(o){o.addEventListener('click',function(){var s=document.getElementById(o.getAttribute('data-o')),v=s.type==='password';s.type=v?'text':'password';o.setAttribute('aria-label',v?'Ocultar senha':'Mostrar senha');s.focus()})});
document.getElementById('f').addEventListener('submit',function(){var b=document.getElementById('b');if(!b)return;b.disabled=true;b.textContent='${esc(o.ocupado || 'Entrando…')}'});
</script></body></html>`;
export const htmlResp = (corpo, status = 200, extra = {}) => new Response(corpo, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...extra } });
