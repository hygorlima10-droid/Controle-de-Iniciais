/* ============================================================
   USUÁRIOS E CONVITES (prefixo us): Configurações › Usuários (só o proprietário)
   Lista de pessoas e convites pendentes, convidar (link de 48 h, uso único), ficha da pessoa (permissões, OABs, aparelhos, desativar).
   O servidor decide tudo (/api/usuarios); a tela só mostra e pede. O proprietário nunca vê nem define a senha de ninguém.
   ============================================================ */
var usS = { tela: 'lista', dados: null, oabsCad: [], sel: null, form: null, link: null, ocupado: false, sessoes: [], msg: '' };
var US_PAPEL = { proprietario: 'proprietário', advogado: 'advogado', estagiario: 'estagiário' };
var US_PERMS = [
  { k: 'verPublicacoes', t: 'Ver as publicações de todo o escritório', s: 'só leitura', para: ['estagiario'] },
  { k: 'verAgendas', t: 'Ver as agendas de todo o escritório', s: 'inclui as tarefas pessoais de todos', para: ['estagiario'] },
  { k: 'verTotais', t: 'Ver totais e indicadores de honorários', s: 'sem isso, só vê o que lança', para: ['advogado', 'estagiario'] },
  { k: 'excluir', t: 'Excluir registros', s: 'desligado por padrão; o que se apaga vai para a lixeira por 30 dias', para: ['advogado', 'estagiario'] }
];
function usPadrao(papel){ return { verPublicacoes: papel === 'estagiario', verAgendas: papel === 'estagiario', verTotais: papel === 'advogado', excluir: false }; }
function usAbrir(){
  var ov = sgMontar('overlayUsuarios', 'Usuários');
  if (!ov.getAttribute('data-us')){
    ov.setAttribute('data-us', '1');
    ov.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-us]') : null; if (b && b !== ov) usClique(b.getAttribute('data-us'), b.getAttribute('data-k'), b); });
    ov.addEventListener('input', function(e){ var t = e.target; if (t && t.getAttribute && t.getAttribute('data-usf') && usS.form){ usS.form[t.getAttribute('data-usf')] = t.value; } });
    ov.addEventListener('change', function(e){ var t = e.target; if (!t || !t.getAttribute) return;
      var p = t.getAttribute('data-usp'); if (p){ usPermMudou(p, t.checked); return; }
      var o = t.getAttribute('data-uso'); if (o){ usOabMarcou(o, t.checked); return; }
      if (t.getAttribute('data-usf') === 'papel-ficha') usPapelFicha(t.value);
    });
  }
  usS.tela = 'lista'; usS.msg = ''; ov.classList.add('show'); usCarregar();
}
function usCarregar(){
  qs('overlayUsuariosC').innerHTML = usS.dados ? '' : '<div class="saldo-data">Carregando…</div>';
  return Promise.all([sgApi('/api/usuarios'), sgApi('/api/djen/estado').catch(function(){ return { oabs: [] }; })]).then(function(r){
    usS.dados = r[0]; usS.oabsCad = (r[1].oabs || []).filter(function(o){ return o.numero && o.uf; }); usDesenhar();
  }).catch(function(e){
    qs('overlayUsuariosC').innerHTML = '<div class="pb-aviso">' + (/individual|404/.test(e.message) ? 'Esta tela fica disponível quando o acesso individual (e-mail e senha) está ativo.' : 'Não consegui abrir: ' + escapeHtml(e.message)) + '</div>';
  });
}
function usChave(o){ return String(o.numero).replace(/\D/g, '').replace(/^0+/, '') + '/' + String(o.uf).toUpperCase().slice(0, 2); }
function usChip(t, c){ return '<span class="pb-tg ' + (c || '') + '">' + escapeHtml(t) + '</span>'; }
function usHoras(iso){ var h = Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 36e5)); return h >= 1 ? 'vence em ' + h + ' h' : 'vence em menos de 1 h'; }
function usVoltar(txt){ return '<div class="pb-acts" style="justify-content:flex-start;margin:0 0 6px"><button type="button" class="btn btn-ghost pb-b" data-us="voltar">‹ ' + (txt || 'Usuários') + '</button></div>'; }
function usDesenhar(){
  var el = qs('overlayUsuariosC'); if (!el || !usS.dados) return;
  el.innerHTML = usS.tela === 'convidar' ? usHtmlConvidar() : usS.tela === 'link' ? usHtmlLink() : usS.tela === 'ficha' ? usHtmlFicha() : usS.tela === 'convite' ? usHtmlConvitePendente() : usHtmlLista();
}
function usHtmlLista(){
  var d = usS.dados, h = '<div class="pb-sec"><div class="pb-sec-t">Pessoas com acesso (' + d.usuarios.length + ')</div></div>';
  h += d.usuarios.map(function(u){
    var info = u.emUso ? 'em uso agora' : (u.ultimoAcesso ? 'último acesso ' + sgDataHora(u.ultimoAcesso) + (u.aparelho ? ' · ' + u.aparelho : '') : 'ainda não entrou');
    var linha2 = US_PAPEL[u.papel] + (u.papel === 'advogado' ? ' · OAB ' + (u.oabs.length ? u.oabs.join(', ') : 'não indicada') : (u.papel === 'proprietario' ? ' · todas as OABs' : ''));
    return '<div class="pb-card" style="--pb-bar:' + (u.papel === 'proprietario' ? '#C98500' : u.ativo ? '#2A78D6' : '#8A93AD') + '"><div class="pb-l1"><span><b>' + escapeHtml(u.nome) + '</b>' + (u.emUso ? ' <span class="saldo-data">(você)</span>' : '') + '</span><span>' + usChip(US_PAPEL[u.papel], u.papel === 'proprietario' ? 'at' : '') + (u.ativo ? '' : usChip('desativado', 'at')) + '</span></div>' +
      '<div class="pb-proc">' + escapeHtml(u.email) + '</div><div class="pb-proc">' + escapeHtml(linha2) + '</div><div class="pb-proc">' + escapeHtml(info) + '</div>' +
      (u.papel === 'proprietario' ? '' : '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-us="abrir" data-k="' + escapeHtml(u.id) + '">Abrir</button></div>') + '</div>';
  }).join('');
  if (d.convites.length){
    h += '<div class="pb-sec" style="margin-top:12px"><div class="pb-sec-t">Convites pendentes (' + d.convites.length + ')</div></div>' + d.convites.map(function(c){
      return '<div class="pb-card" style="--pb-bar:#C98500"><div class="pb-l1"><span><b>' + escapeHtml(c.nome) + '</b></span><span>' + usChip(US_PAPEL[c.papel]) + usChip('convite pendente', 'at') + '</span></div><div class="pb-proc">' + escapeHtml(c.email) + ' · ' + escapeHtml(usHoras(c.expira)) + '</div>' +
        '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-us="abrir-convite" data-k="' + escapeHtml(c.id) + '">Abrir</button></div></div>';
    }).join('');
  }
  h += '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-us="convidar">Convidar pessoa</button></div>' +
    '<div class="pb-aviso" style="margin:8px 4px">Cada pessoa cria a própria senha pelo link. Você nunca vê nem define a senha de ninguém.</div>';
  return h;
}
/* ---------- convidar ---------- */
function usNovoForm(){ usS.form = { nome: '', email: '', papel: 'estagiario', oabs: [], outraNum: '', outraUf: 'GO', perm: usPadrao('estagiario'), erro: '' }; }
function usOabsCampo(sel, prefixo){
  var cad = usS.oabsCad.map(function(o){ return { k: usChave(o), t: (o.nome ? o.nome.split(' ')[0] + ' · ' : '') + o.numero + '/' + o.uf }; }), chaves = cad.map(function(c){ return c.k; });
  var extra = sel.filter(function(k){ return chaves.indexOf(k) < 0; }).map(function(k){ return { k: k, t: k }; });
  var h = cad.concat(extra).map(function(c){ return '<label class="ad-it" style="border:0;padding:3px 0"><input type="checkbox" data-uso="' + escapeHtml(c.k) + '"' + (sel.indexOf(c.k) >= 0 ? ' checked' : '') + '><span class="ad-t">' + escapeHtml(c.t) + '</span></label>'; }).join('');
  return h + '<div class="saldo-data" style="margin:6px 0 2px">Outra OAB (sem limite de OABs por pessoa):</div><div style="display:flex;gap:6px;align-items:center"><input type="text" inputmode="numeric" placeholder="Número" data-usf="outraNum" value="' + escapeHtml(usS.form && usS.form.outraNum || '') + '" style="flex:1;min-width:0"><input type="text" maxlength="2" data-usf="outraUf" value="' + escapeHtml(usS.form && usS.form.outraUf || 'GO') + '" style="width:56px;text-transform:uppercase"><button type="button" class="btn btn-ghost pb-b" data-us="' + prefixo + '-outra-oab">Adicionar OAB</button></div>';
}
function usPermsHtml(papel, perm, atr){
  return US_PERMS.filter(function(p){ return p.para.indexOf(papel) >= 0; }).map(function(p){
    return '<label class="ad-it" style="border:0;padding:5px 0;align-items:flex-start"><input type="checkbox" ' + atr + '="' + p.k + '"' + (perm[p.k] ? ' checked' : '') + '><span class="ad-t">' + escapeHtml(p.t) + '<br><span class="saldo-data">' + escapeHtml(p.s) + '</span></span></label>';
  }).join('');
}
function usHtmlConvidar(){
  var f = usS.form;
  return usVoltar() + '<div class="pb-sec"><div class="pb-sec-t">Convidar pessoa</div><div class="pb-aviso">Ela recebe um link e cria a própria senha. O e-mail que você informar será o login dela, e ela não consegue trocá-lo.</div></div>' +
    '<div class="field"><label class="field-label" for="usNome">Nome</label><input type="text" id="usNome" data-usf="nome" maxlength="80" value="' + escapeHtml(f.nome) + '" autocomplete="off"></div>' +
    '<div class="field"><label class="field-label" for="usEmail">E-mail (será o login)</label><input type="email" id="usEmail" data-usf="email" maxlength="120" value="' + escapeHtml(f.email) + '" autocomplete="off"></div>' +
    '<div class="field"><label class="field-label">Papel</label><div class="pb-acts" style="justify-content:flex-start;margin:0"><button type="button" class="btn ' + (f.papel === 'advogado' ? 'btn-primary' : 'btn-ghost') + ' pb-b" data-us="papel" data-k="advogado">Advogado</button><button type="button" class="btn ' + (f.papel === 'estagiario' ? 'btn-primary' : 'btn-ghost') + ' pb-b" data-us="papel" data-k="estagiario">Estagiário</button></div></div>' +
    (f.papel === 'advogado' ? '<div class="field"><label class="field-label">De quem é a OAB?</label>' + usOabsCampo(f.oabs, 'novo') + '<div class="saldo-data" style="margin-top:4px">É o que decide quais processos ele enxerga. Marque quantas forem necessárias.</div></div>' : '') +
    '<div class="pb-sec" style="margin-top:8px"><div class="pb-sec-t">O que ' + (f.papel === 'advogado' ? 'o advogado' : 'o estagiário') + ' pode</div></div>' + usPermsHtml(f.papel, f.perm, 'data-usp') +
    '<div class="pb-aviso" style="margin:6px 4px">' + (f.papel === 'advogado' ? 'O advogado vê, lança e cobra só os processos em que está cadastrado e marca o recebimento dos honorários deles.' : 'O estagiário lança e edita Iniciais, Acordos e Alvarás e faz cobrança, mas <b>não marca recebimento</b> de honorários e <b>não abre</b> finanças, configurações nem backup.') + ' Nenhum dos dois abre as suas finanças pessoais.</div>' +
    (f.erro ? '<div class="form-error">' + escapeHtml(f.erro) + '</div>' : '') +
    '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-us="gerar">Gerar link de convite</button></div>';
}
function usGerar(){
  var f = usS.form; if (usS.ocupado) return;
  if (f.nome.trim().length < 2) { f.erro = 'Informe o nome da pessoa.'; return usDesenhar(); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) { f.erro = 'Informe um e-mail válido.'; return usDesenhar(); }
  if (f.papel === 'advogado' && !f.oabs.length) { f.erro = 'Marque ao menos uma OAB para o advogado.'; return usDesenhar(); }
  usS.ocupado = true;
  sgApi('/api/usuarios', 'POST', { nome: f.nome.trim(), email: f.email.trim(), papel: f.papel, oabs: f.papel === 'advogado' ? f.oabs : [], permissoes: f.perm }).then(function(r){
    usS.ocupado = false; usS.link = { link: r.link, expira: r.expira, nome: f.nome.trim(), papel: f.papel, copiado: false }; usS.tela = 'link'; usS.dados = null; usDesenhar0(); usCarregar0();
  }).catch(function(e){ usS.ocupado = false; f.erro = e.message; usDesenhar(); });
}
function usDesenhar0(){ var el = qs('overlayUsuariosC'); if (el && usS.tela === 'link') el.innerHTML = usHtmlLink(); }
function usCarregar0(){ sgApi('/api/usuarios').then(function(r){ usS.dados = r; }); }
function usHtmlLink(){
  var l = usS.link, txt = 'Olá! Segue o seu convite para o Horus. Abra o link, confira seus dados e crie a sua senha (vale por 48 horas e só pode ser usado uma vez): ' + l.link;
  return usVoltar() + '<div class="pb-sec"><div class="pb-sec-t">Convite criado · ' + escapeHtml(l.nome) + ' (' + US_PAPEL[l.papel] + ')</div></div>' +
    '<div class="field"><label class="field-label" for="usLink">Link de convite</label><input type="text" id="usLink" readonly value="' + escapeHtml(l.link) + '" style="font-family:ui-monospace,monospace;font-size:var(--t2)"></div>' +
    '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-us="copiar">' + (l.copiado ? 'Link copiado ✓' : 'Copiar link') + '</button><a class="btn btn-ghost pb-b" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(txt) + '" style="text-decoration:none">Enviar pelo WhatsApp</a></div>' +
    '<div class="pb-aviso" style="margin:8px 4px">Vale por <b>48 horas</b> e <b>só pode ser usado uma vez</b>. Este link aparece só agora: se perder, abra o convite na lista e gere outro.</div>';
}
/* ---------- ficha de uma pessoa ---------- */
function usPessoa(id){ return (usS.dados.usuarios || []).filter(function(u){ return u.id === id; })[0]; }
function usAbrirFicha(id){ usS.sel = id; usS.tela = 'ficha'; usS.sessoes = []; usS.msg = ''; usDesenhar(); sgApi('/api/usuarios/' + encodeURIComponent(id) + '/sessoes').then(function(r){ usS.sessoes = r.sessoes || []; if (usS.tela === 'ficha' && usS.sel === id) usDesenhar(); }).catch(function(){}); }
function usHtmlFicha(){
  var u = usPessoa(usS.sel); if (!u) return usVoltar() + '<div class="pb-aviso">Pessoa não encontrada.</div>';
  var h = usVoltar() + '<div class="pb-sec"><div class="pb-sec-t">' + escapeHtml(u.nome) + '</div><div class="pb-aviso">' + escapeHtml(u.email) + ' · ' + US_PAPEL[u.papel] + (u.ativo ? '' : ' · <b>desativado</b>') + (u.criadoEm ? ' · entrou em ' + escapeHtml(new Date(u.criadoEm).toLocaleDateString('pt-BR')) : '') + '</div></div>';
  h += '<div class="field"><label class="field-label" for="usPapelFicha">Papel</label><select id="usPapelFicha" class="filter-select" data-usf="papel-ficha" style="width:100%"><option value="advogado"' + (u.papel === 'advogado' ? ' selected' : '') + '>Advogado</option><option value="estagiario"' + (u.papel === 'estagiario' ? ' selected' : '') + '>Estagiário</option></select></div>';
  if (u.papel === 'advogado') h += '<div class="field"><label class="field-label">OABs vinculadas</label>' + usOabsCampo(u.oabs, 'ficha') + '</div>';
  h += '<div class="pb-sec" style="margin-top:8px"><div class="pb-sec-t">Permissões</div></div>' + usPermsHtml(u.papel, u.permissoes, 'data-usp');
  h += '<div class="pb-sec" style="margin-top:8px"><div class="pb-sec-t">Aparelhos conectados</div></div>' + (usS.sessoes.length ? usS.sessoes.map(function(s){
    return '<div class="pb-card" style="--pb-bar:#8A93AD"><div class="pb-l1"><span>' + sgSegIcone(s.rotulo) + ' ' + escapeHtml(s.rotulo) + '</span></div><div class="pb-proc">' + (s.lugar ? escapeHtml(s.lugar) + ' · ' : '') + 'último uso ' + escapeHtml(sgDataHora(s.ultimo)) + '</div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-us="encerrar" data-k="' + escapeHtml(s.id) + '">Encerrar</button></div></div>';
  }).join('') : '<div class="saldo-data">Nenhum aparelho conectado agora.</div>');
  h += '<div class="pb-acts">' + (usS.sessoes.length > 1 ? '<button type="button" class="btn btn-ghost pb-b" data-us="encerrar-todas">Encerrar todas as sessões</button>' : '') +
    (u.ativo ? (usS.msg === 'desativar' ? '<button type="button" class="btn btn-primary pb-b" data-us="desativar-ok">Confirmar: desativar agora</button><button type="button" class="btn btn-ghost pb-b" data-us="desativar-nao">Cancelar</button>' : '<button type="button" class="btn btn-ghost pb-b" data-us="desativar">Desativar acesso</button>') : '<button type="button" class="btn btn-primary pb-b" data-us="reativar">Reativar acesso</button>') + '</div>' +
    '<div class="pb-aviso" style="margin:6px 4px">Desativar tira o acesso na hora e encerra as sessões, mas guarda o histórico do que a pessoa fez. Dá para reativar. Não existe “excluir pessoa”.</div>';
  return h;
}
function usHtmlConvitePendente(){
  var c = (usS.dados.convites || []).filter(function(x){ return x.id === usS.sel; })[0]; if (!c) return usVoltar() + '<div class="pb-aviso">Convite não encontrado (já usado, vencido ou cancelado).</div>';
  return usVoltar() + '<div class="pb-sec"><div class="pb-sec-t">' + escapeHtml(c.nome) + '</div><div class="pb-aviso">' + escapeHtml(c.email) + ' · ' + US_PAPEL[c.papel] + (c.papel === 'advogado' ? ' · OAB ' + escapeHtml(c.oabs.join(', ')) : '') + ' · ' + escapeHtml(usHoras(c.expira)) + '</div></div>' +
    '<div class="pb-aviso">O link anterior não pode ser mostrado de novo (o servidor guarda só o resumo dele). Gere outro: o anterior deixa de valer.</div>' +
    '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-us="novo-link" data-k="' + escapeHtml(c.id) + '">Gerar outro link</button><button type="button" class="btn btn-ghost pb-b" data-us="cancelar-convite" data-k="' + escapeHtml(c.id) + '">Cancelar convite</button></div>';
}
/* ---------- ações ---------- */
function usPut(corpo, ok){
  var u = usPessoa(usS.sel); if (!u || usS.ocupado) return Promise.resolve(); usS.ocupado = true;
  return sgApi('/api/usuarios/' + encodeURIComponent(u.id), 'PUT', corpo).then(function(r){ usS.ocupado = false; Object.keys(r).forEach(function(k){ u[k] = r[k]; }); if (ok) toast(ok); usS.msg = ''; usDesenhar(); return usCarregar0(); })
    .catch(function(e){ usS.ocupado = false; toast('Não consegui salvar: ' + e.message); usDesenhar(); });
}
function usPermMudou(k, v){
  if (usS.tela === 'convidar') { usS.form.perm[k] = v; return; }
  var u = usPessoa(usS.sel); if (!u) return; var o = {}; o[k] = v; usPut({ permissoes: o }, 'Permissão atualizada.');
}
function usOabMarcou(k, v){
  if (usS.tela === 'convidar') { var l = usS.form.oabs, i = l.indexOf(k); if (v && i < 0) l.push(k); if (!v && i >= 0) l.splice(i, 1); return; }
  var u = usPessoa(usS.sel); if (!u) return; var n = u.oabs.filter(function(x){ return x !== k; }); if (v) n.push(k);
  if (!n.length){ toast('Advogado precisa de ao menos uma OAB.'); usDesenhar(); return; }
  usPut({ oabs: n }, 'OABs atualizadas.');
}
function usOutraOab(onde){
  var f = usS.form || {}, num = String(f.outraNum || '').replace(/\D/g, '').replace(/^0+/, ''), uf = String(f.outraUf || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (num.length < 3 || uf.length !== 2){ toast('Informe o número da OAB e a UF (duas letras).'); return; }
  var k = num + '/' + uf; f.outraNum = '';
  if (onde === 'novo'){ if (f.oabs.indexOf(k) < 0) f.oabs.push(k); usDesenhar(); }
  else { var u = usPessoa(usS.sel); if (u && u.oabs.indexOf(k) < 0) usPut({ oabs: u.oabs.concat([k]) }, 'OAB acrescentada.'); }
}
function usPapelFicha(p){ var u = usPessoa(usS.sel); if (!u || u.papel === p) return; usPut({ papel: p }, 'Papel alterado.'); }
function usClique(a, k, b){
  if (a === 'voltar'){ usS.tela = 'lista'; usS.msg = ''; usDesenhar(); usCarregar(); }
  else if (a === 'convidar'){ usNovoForm(); usS.tela = 'convidar'; usDesenhar(); }
  else if (a === 'papel'){ usS.form.papel = k; usS.form.perm = usPadrao(k); usDesenhar(); }
  else if (a === 'novo-outra-oab') usOutraOab('novo');
  else if (a === 'ficha-outra-oab') usOutraOab('ficha');
  else if (a === 'gerar') usGerar();
  else if (a === 'copiar'){
    var l = usS.link, fim = function(){ l.copiado = true; qs('overlayUsuariosC').innerHTML = usHtmlLink(); };
    try { navigator.clipboard.writeText(l.link).then(fim, function(){ var i = qs('usLink'); i.select(); document.execCommand('copy'); fim(); }); } catch (e) { var i2 = qs('usLink'); if (i2){ i2.select(); try { document.execCommand('copy'); } catch (x) {} } fim(); }
  }
  else if (a === 'abrir') usAbrirFicha(k);
  else if (a === 'abrir-convite'){ usS.sel = k; usS.tela = 'convite'; usDesenhar(); }
  else if (a === 'novo-link'){ if (usS.ocupado) return; usS.ocupado = true; var c = (usS.dados.convites || []).filter(function(x){ return x.id === k; })[0]; sgApi('/api/usuarios/convites/' + encodeURIComponent(k) + '/novo-link', 'POST', {}).then(function(r){ usS.ocupado = false; usS.link = { link: r.link, expira: r.expira, nome: c ? c.nome : '', papel: c ? c.papel : 'estagiario', copiado: false }; usS.tela = 'link'; usDesenhar0(); usCarregar0(); }).catch(function(e){ usS.ocupado = false; toast('Não consegui gerar: ' + e.message); }); }
  else if (a === 'cancelar-convite'){ if (usS.ocupado) return; usS.ocupado = true; sgApi('/api/usuarios/convites/' + encodeURIComponent(k), 'DELETE').then(function(){ usS.ocupado = false; toast('Convite cancelado.'); usS.tela = 'lista'; usCarregar(); }).catch(function(e){ usS.ocupado = false; toast('Não consegui cancelar: ' + e.message); }); }
  else if (a === 'encerrar' || a === 'encerrar-todas'){
    if (usS.ocupado) return; usS.ocupado = true; var id = usS.sel;
    sgApi('/api/usuarios/' + encodeURIComponent(id) + '/sessoes' + (a === 'encerrar' ? '/' + encodeURIComponent(k) : ''), 'DELETE').then(function(){ usS.ocupado = false; toast('Sessão encerrada.'); usAbrirFicha(id); usCarregar0(); }).catch(function(e){ usS.ocupado = false; toast('Não consegui encerrar: ' + e.message); });
  }
  else if (a === 'desativar'){ usS.msg = 'desativar'; usDesenhar(); }
  else if (a === 'desativar-nao'){ usS.msg = ''; usDesenhar(); }
  else if (a === 'desativar-ok') usPut({ ativo: false }, 'Acesso desativado.').then(function(){ usAbrirFicha(usS.sel); });
  else if (a === 'reativar') usPut({ ativo: true }, 'Acesso reativado.');
}
window.__horusTeste = Object.assign(window.__horusTeste || {}, { usAbrir: usAbrir });
(function(){
  var st = document.createElement('style');
  st.textContent = '#overlayUsuariosC>*{flex-shrink:0}#overlayUsuariosC .ad-it input[type=checkbox]{flex:none}';
  document.head.appendChild(st);
})();
