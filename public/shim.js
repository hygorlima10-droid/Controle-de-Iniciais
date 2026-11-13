/* Faz o app (que foi feito para rodar dentro do Claude) funcionar neste servidor:
   "claude.use('db')" passa a falar com /api/db (banco D1) e "claude.use('downloads')" baixa o arquivo. */
(function () {
  window.__SERVIDOR = true;
  var colecoes = {};
  /* Quem está usando (Fase 5, 5.7): o app pergunta uma vez ao servidor e marca a página (<html>) com o papel. Quem não é o proprietário não pede ao servidor as coleções de
     finanças (despesas, receitas, saldos, metas, extratos, obra, configurações do proprietário): elas ficam vazias e nenhuma mensagem de "sincronizando" aparece. */
  var DONO = { despesas: 1, receitasManuais: 1, saldos: 1, metas: 1, extratos: 1, obraMov: 1, configDono: 1 };
  var EU = window.__horusEu = { papel: 'proprietario', pronto: false, permissoes: {} };
  var EUP = fetch('/api/eu', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (j && j.papel) { EU.papel = j.papel; EU.nome = j.nome; EU.id = j.id; EU.oabs = j.oabs || []; EU.permissoes = j.permissoes || {}; }
    window.__papel = EU.papel;
    var h = document.documentElement.classList, so = EU.papel !== 'proprietario';
    h.toggle('so-central', so); h.toggle('papel-advogado', EU.papel === 'advogado'); h.toggle('papel-estagiario', EU.papel === 'estagiario');
    h.toggle('sem-totais', so && !EU.permissoes.verTotais);
  }).catch(function () { }).then(function () { EU.pronto = true; try { window.dispatchEvent(new CustomEvent('horus-eu')); } catch (e) { } });
  function semAcesso(nome) { return !!DONO[nome] && EU.papel !== 'proprietario'; }
  function req(metodo, caminho, corpo) {
    return fetch(caminho, { method: metodo, headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined, body: corpo !== undefined ? JSON.stringify(corpo) : undefined, credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) {}
          if (r.status === 401 && j) { location.href = '/login'; }
          if (!r.ok || !j) {
            var e2 = (j && j.error) || { code: r.status === 401 || r.status === 403 ? 'not_granted' : 'unavailable', message: 'Erro ' + r.status };
            if (j && j.atual) e2.atual = j.atual;   // conflito de edição: a versão que está no servidor
            throw e2;
          }
          return j;
        });
      }, function () { throw { code: 'unavailable', message: 'Sem conexão com o servidor.' }; });
  }
  /* Coleções SEM teto de registros: o servidor entrega páginas de 1.000 ("depois do id X") e o app lê página a página até acabar.
     A 1ª página já libera a tela e as outras chegam em seguida (aviso "carregando mais…"); nas releituras de 15 em 15 segundos só se relê tudo se a "ficha"
     da coleção (quantidade + última alteração) mudou. Cada registro guarda a versão (carimbo) que o app leu, para o servidor detectar edição em outro aparelho. */
  var MAX_PAGINAS = 120;
  function avisarCarga(c, lidos, completo) { try { window.dispatchEvent(new CustomEvent('horus-carga', { detail: { nome: c.nome, lidos: lidos, completo: completo } })); } catch (e) { } }
  /* Escopo "Meus | Escritório" do proprietário (Fase 5, 5.4): em "Meus" o app só enxerga os registros em que alguma das OABs dele está entre os advogados responsáveis.
     É só uma visão: o que está guardado (c.mapa) e as gravações não mudam. Quem não é proprietário não tem este botão (o servidor já filtra para ele). */
  var ESC = window.__horusEscopo = { modo: 'escritorio', pub: 'minhas', ativo: false, oabs: [], procClienteIds: {}, procNums: {}, nums: {} };
  try { ESC.modo = localStorage.getItem('horus.escopo') === 'meus' ? 'meus' : 'escritorio'; ESC.pub = localStorage.getItem('horus.escopoPub') === 'todas' ? 'todas' : 'minhas'; } catch (e) { }
  var ESCOPADAS = { casos: 1, termosAcordo: 1, alvaras: 1 };
  function oabsDe(d) { return (d && Array.isArray(d.advogados) ? d.advogados : []).map(function (a) { return a && a.oab; }).filter(Boolean); }
  function direto(d) { return oabsDe(d).some(function (k) { return ESC.oabs.indexOf(k) >= 0; }); }
  function numDe(d) { var n = String(d && (d.numero || d.numeroProcesso) || '').replace(/\D/g, ''); return n.length >= 15 ? n : ''; }
  /* o processo é a unidade: um registro é "meu" se eu estou nele OU se estou em qualquer outro registro do mesmo número (Inicial, Acordo, Alvará ou o cadastro do processo) */
  function recalcNums() {
    var n = {}; Object.keys(ESC.procNums || {}).forEach(function (k) { n[k] = 1; });
    ['casos', 'termosAcordo', 'alvaras'].forEach(function (k) { var m = colecoes[k] ? colecoes[k].mapa : {}; Object.keys(m).forEach(function (id) { var x = numDe(m[id]); if (x && direto(m[id])) n[x] = 1; }); });
    ESC.nums = n;
  }
  function souMeu(d) { if (direto(d)) return true; var x = numDe(d); return !!(x && ESC.nums && ESC.nums[x]); }
  function normN(x) { var t = String(x == null ? '' : x); try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { } return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function escopoLigado() { return ESC.ativo && ESC.modo === 'meus'; }
  function nomesMeus() { var n = {}; recalcNums(); ['casos', 'termosAcordo', 'alvaras'].forEach(function (k) { var m = colecoes[k] ? colecoes[k].mapa : {}; Object.keys(m).forEach(function (id) { if (souMeu(m[id]) && m[id].cliente) n[normN(m[id].cliente)] = 1; }); }); return n; }
  function visivel(nome, id, d) {
    if (!escopoLigado()) return true;
    if (ESCOPADAS[nome]) return souMeu(d);   // (recalcNums já rodou no início de c.docs)
    if (nome === 'clientes') { var nm = nomesMeus(); return !!ESC.procClienteIds[id] || !!nm[normN(d && d.nome)]; }
    return true;
  }
  ESC.meuDoc = function (d) { recalcNums(); return souMeu(d); };
  ESC.meuNum = function (n) { recalcNums(); return !!ESC.nums[String(n || '').replace(/\D/g, '')]; };
  ESC.aplicar = function (modo) {
    if (modo) { ESC.modo = modo === 'meus' ? 'meus' : 'escritorio'; try { localStorage.setItem('horus.escopo', ESC.modo); } catch (e) { } }
    Object.keys(colecoes).forEach(function (k) { colecoes[k].avisar(); });
    try { window.dispatchEvent(new CustomEvent('horus-escopo')); } catch (e) { }
  };
  function colecao(nome) {
    if (colecoes[nome]) return colecoes[nome];
    var c = colecoes[nome] = { nome: nome, mapa: {}, versoes: {}, fila: {}, inscritos: [], carregada: false, parcial: false, pendentes: 0, assinatura: '', token: '', timer: null };
    c.docs = function (lim) {
      var ids = Object.keys(c.mapa).sort();
      if (escopoLigado()) { recalcNums(); ids = ids.filter(function (id) { return visivel(c.nome, id, c.mapa[id]); }); }
      if (lim) ids = ids.slice(0, lim);
      return ids.map(function (id) { var v = c.mapa[id]; return { id: id, data: function () { return JSON.parse(JSON.stringify(v)); } }; });
    };
    c.avisar = function () { c.inscritos.forEach(function (s) { s.cb({ docs: c.docs(s.lim) }); }); };
    var base = '/api/db/' + encodeURIComponent(nome);
    c.lerTudo = function () {
      var primeiraCarga = !c.carregada, novo = {}, nvers = {}, lidos = 0, paginas = 0, token = '';
      function pagina(depois) {
        return req('GET', base + '?limit=1000' + (depois ? '&after=' + encodeURIComponent(depois) : '')).then(function (j) {
          if (!primeiraCarga && c.pendentes > 0) return;   // há gravação em andamento: deixa para a próxima rodada
          if (paginas === 0) token = j.n + '|' + j.t;
          paginas++;
          j.docs.forEach(function (d) { lidos++; if (primeiraCarga) { c.mapa[d.id] = d.data; c.versoes[d.id] = d.v; } else { novo[d.id] = d.data; nvers[d.id] = d.v; } });
          var ha = !!(j.mais && j.docs.length && paginas < MAX_PAGINAS);
          if (primeiraCarga) {
            c.carregada = true; c.parcial = ha; c.avisar();
            if (ha || paginas > 1) avisarCarga(c, lidos, !ha);
          }
          if (ha) return pagina(j.docs[j.docs.length - 1].id);
          if (!primeiraCarga) {
            if (c.pendentes > 0) return;
            c.mapa = novo; c.versoes = nvers; c.avisar();
            if (paginas > 1) avisarCarga(c, lidos, true);
          }
          c.token = token; c.parcial = false;
        });
      }
      return pagina('');
    };
    var lerTudoOrig = c.lerTudo;
    var vazia = function () { if (!c.carregada) { c.carregada = true; c.parcial = false; c.avisar(); } return Promise.resolve(); };   /* coleção do proprietário para outro papel: nasce vazia, uma vez, sem pedir nada ao servidor */
    c.lerTudo = function () { return semAcesso(c.nome) ? vazia() : lerTudoOrig(); };
    c.carregar = function () {
      if (!EU.pronto) return EUP.then(function () { return c.carregar(); });
      if (semAcesso(c.nome)) return vazia();
      if (c.carregada && !c.parcial) {
        return req('GET', base + '?resumo=1').then(function (r) {
          if (c.pendentes > 0 || (r.n + '|' + r.t) === c.token) return;
          return c.lerTudo();
        });
      }
      if (c.parcial) return Promise.resolve();   // ainda lendo as páginas
      return c.lerTudo();
    };
    c.iniciarVigia = function () {
      if (c.timer) return;
      c.timer = setInterval(function () { if (!document.hidden) c.carregar().catch(function () {}); }, 15000);
    };
    return c;
  }
  /* lê uma coleção inteira (todas as páginas) sem passar pelo cache: usado pelas telas que carregam a sua própria lista (agenda, processos…) */
  function listarTudo(nome) {
    if (!EU.pronto && DONO[nome]) return EUP.then(function () { return listarTudo(nome); });
    if (semAcesso(nome)) return Promise.resolve({ docs: [] });
    var docs = [], paginas = 0;
    function pagina(depois) {
      return req('GET', '/api/db/' + encodeURIComponent(nome) + '?limit=1000' + (depois ? '&after=' + encodeURIComponent(depois) : '')).then(function (j) {
        paginas++; docs = docs.concat(j.docs);
        if (j.mais && j.docs.length && paginas < MAX_PAGINAS) return pagina(j.docs[j.docs.length - 1].id);
        if (nome === 'processos') {   // guarda quais clientes estão nos processos "meus" (para o filtro de Clientes); a lista de processos continua inteira (o cadastro precisa conhecer todos, para não duplicar): a tela Processos é que filtra
          var pn = {}; docs.forEach(function (d) { var x = numDe(d.data); if (x && direto(d.data)) pn[x] = 1; }); ESC.procNums = pn; recalcNums();
          var ci = {}; docs.forEach(function (d) { if (souMeu(d.data) && Array.isArray(d.data.clienteIds)) d.data.clienteIds.forEach(function (i) { ci[String(i)] = 1; }); }); ESC.procClienteIds = ci;
        }
        return { docs: docs };
      });
    }
    return pagina('');
  }
  window.__horusListarTudo = listarTudo;
  window.__horusDb = { recarregar: function (n) { return colecao(n).lerTudo(); }, total: function (n) { return Object.keys(colecao(n).mapa).length; }, completo: function () { return Object.keys(colecoes).every(function (n) { return !colecoes[n].parcial; }); }, versao: function (n, id) { return colecao(n).versoes[id]; } };

  /* Diário do "Desfazer": guarda como cada documento estava antes de cada gravação/exclusão (últimas 20 ações). */
  var ROTULO_COL = { casos: 'petição', termosAcordo: 'acordo', alvaras: 'alvará', clientes: 'cliente', despesas: 'despesa', receitasManuais: 'receita', metas: 'meta', saldos: 'saldo', obraMov: 'lançamento da obra', extratos: 'extrato' };
  var DIARIO_KEY = 'controle.desfazer.v1', desfazendo = false, diario = [];
  try { diario = JSON.parse(localStorage.getItem(DIARIO_KEY) || '[]') || []; } catch (e) { diario = []; }
  function salvarDiario() { try { localStorage.setItem(DIARIO_KEY, JSON.stringify(diario.slice(-20))); } catch (e) { diario = diario.slice(-5); } window.dispatchEvent(new Event('desfazer-mudou')); }
  function nomeDoc(d) { return d ? String(d.cliente || d.nome || d.partes || d.descricao || '').slice(0, 40) : ''; }
  function registrar(c, id, antes, existia, depois, apagar) {
    if (desfazendo || !ROTULO_COL[c.nome]) return;
    if (c.nome === 'extratos' && /^(h_)/.test(id)) return;   // marcas internas de lançamentos já importados
    var agora = Date.now(), g = diario[diario.length - 1];
    if (!g || agora - g.t > 2500 || g.grande) { g = { t: agora, ops: [], rotulo: '' }; diario.push(g); }
    g.t = agora;
    if (g.ops.length >= 25) { g.grande = true; g.ops = []; g.rotulo = 'ação grande (não pode ser desfeita)'; salvarDiario(); return; }
    if (g.ops.length === 0) g.rotulo = (apagar ? 'apagou ' : (existia ? 'alterou ' : 'criou ')) + ROTULO_COL[c.nome] + (nomeDoc(apagar ? antes : depois) ? ' "' + nomeDoc(apagar ? antes : depois) + '"' : '');
    else if (g.ops.length === 1) g.rotulo += ' (e mais alterações)';
    g.ops.push({ c: c.nome, id: id, antes: existia ? antes : null, existia: !!existia });
    salvarDiario();
  }
  function ultimoDiario() { for (var i = diario.length - 1; i >= 0; i--) if (!diario[i].grande && diario[i].ops.length) return diario[i]; return null; }
  window.__desfazer = {
    ultimo: function () { var g = ultimoDiario(); return g ? { rotulo: g.rotulo, quando: g.t } : null; },
    desfazer: function () {
      var g = ultimoDiario(); if (!g) return Promise.resolve(false);
      desfazendo = true;
      var cadeia = Promise.resolve();
      g.ops.slice().reverse().forEach(function (op) {
        cadeia = cadeia.then(function () { var c = colecao(op.c); return op.existia ? escrever(c, op.id, op.antes, false) : escrever(c, op.id, null, true); });
      });
      return cadeia.then(function () { diario.splice(diario.indexOf(g), 1); desfazendo = false; salvarDiario(); return true; }, function () { desfazendo = false; return false; });
    }
  };

  /* conflito de edição: coleções em que dois aparelhos podem mexer no mesmo registro (o servidor também só confere estas) */
  var CONFLITO = { casos: 1, termosAcordo: 1, alvaras: 1, clientes: 1, despesas: 1, receitasManuais: 1, metas: 1, obraMov: 1 };
  function enviar(c, id, dados, forcar, mesclar) {
    var base = c.versoes[id], q = '';
    if (mesclar) q = '?mesclar=1'; else if (forcar) q = '?forcar=1'; else if (CONFLITO[c.nome] && base && !desfazendo) q = '?base=' + base;
    return req('PUT', '/api/db/' + encodeURIComponent(c.nome) + '/' + encodeURIComponent(id) + q, dados).then(function (j) {
      if (j && j.v) c.versoes[id] = j.v;
      if (mesclar && j && j.doc) { c.mapa[id] = JSON.parse(JSON.stringify(j.doc)); c.avisar(); }   // o servidor devolve o documento já juntado
      return j;
    }, function (e) {
      if (e && e.code === 'conflict' && e.atual) return resolverConflito(c, id, dados, e.atual);
      throw e;
    });
  }
  function resolverConflito(c, id, minha, atual) {
    var fn = window.__horusConflito;
    if (typeof fn !== 'function') return enviar(c, id, minha, true);
    return fn({ colecao: c.nome, id: id, minha: minha, servidor: atual.data, quando: atual.v }).then(function (esc) {
      if (esc === 'outra') { c.mapa[id] = JSON.parse(JSON.stringify(atual.data)); c.versoes[id] = atual.v; c.avisar(); return { ok: true, adotada: true }; }
      return enviar(c, id, minha, true);
    });
  }
  /* as gravações do mesmo registro vão uma depois da outra, para cada uma usar a versão devolvida pela anterior (senão a 2ª pareceria conflito com a 1ª) */
  function naFila(c, id, tarefa) {
    var anterior = c.fila[id] || Promise.resolve(), p = anterior.then(tarefa, tarefa);
    c.fila[id] = p.then(function () { }, function () { });
    return p;
  }
  function escrever(c, id, dados, apagar, mesclar) {
    var antes = c.mapa[id], existia = Object.prototype.hasOwnProperty.call(c.mapa, id);
    if (apagar) delete c.mapa[id]; else c.mapa[id] = JSON.parse(JSON.stringify(mesclar ? Object.assign({}, antes || {}, dados) : dados));
    c.pendentes++; c.avisar();
    registrar(c, id, antes, existia, dados, apagar);
    var p = naFila(c, id, function () {
      return apagar ? req('DELETE', '/api/db/' + encodeURIComponent(c.nome) + '/' + encodeURIComponent(id)).then(function (j) { delete c.versoes[id]; return j; })
                    : enviar(c, id, dados, false, mesclar);
    });
    return p.then(function () { c.pendentes--; c.assinatura = ''; try { if (window.__aposGravar) window.__aposGravar(c.nome); } catch (e) { } }, function (e) {
      c.pendentes--;
      if (existia) c.mapa[id] = antes; else delete c.mapa[id];
      c.avisar(); throw e;
    });
  }
  /* Lote "tudo ou nada": o que precisa ficar junto (transferência PJ/PF = despesa + receita) vai numa só chamada e numa só transação do servidor.
     ops: [{ colecao, id, dados }]  grava;  [{ colecao, id, apagar: true }]  exclui. A tela muda na hora e volta atrás se o servidor recusar. */
  function novoId() { return Math.random().toString(36).slice(2, 12) + Date.now().toString(36); }
  function lote(ops) {
    var feitos = [], cols = {};
    ops.forEach(function (o) {
      var c = colecao(o.colecao), antes = c.mapa[o.id], existia = Object.prototype.hasOwnProperty.call(c.mapa, o.id);
      if (o.apagar) delete c.mapa[o.id]; else c.mapa[o.id] = JSON.parse(JSON.stringify(o.dados));
      c.pendentes++; cols[c.nome] = c;
      registrar(c, o.id, antes, existia, o.dados, !!o.apagar);
      feitos.push({ c: c, id: o.id, antes: antes, existia: existia });
    });
    Object.keys(cols).forEach(function (n) { cols[n].avisar(); });
    var corpo = { ops: ops.map(function (o) { var b = colecao(o.colecao).versoes[o.id]; return Object.assign(o.apagar ? { acao: 'excluir', colecao: o.colecao, id: o.id } : { acao: 'gravar', colecao: o.colecao, id: o.id, dados: o.dados }, CONFLITO[o.colecao] && b ? { base: b } : {}); }) };
    return req('POST', '/api/lote', corpo).then(function () {
      feitos.forEach(function (f) { f.c.pendentes--; f.c.assinatura = ''; delete f.c.versoes[f.id]; });   // o servidor gravou por conta própria: a versão certa só chega na próxima leitura (até lá não se confere conflito deste registro)
    }, function (e) {
      feitos.slice().reverse().forEach(function (f) { f.c.pendentes--; if (f.existia) f.c.mapa[f.id] = f.antes; else delete f.c.mapa[f.id]; });
      Object.keys(cols).forEach(function (n) { cols[n].avisar(); if (e && e.code === 'conflict') { cols[n].assinatura = ''; cols[n].carregar().catch(function () { }); } });   // alguém mexeu em outro aparelho: relê o que está no servidor
      throw e;
    });
  }
  window.__horusLote = { gravar: lote, novoId: novoId };
  var db = {
    collection: function (nome) {
      var c = colecao(nome);
      return {
        limit: function (lim) {
          return { onSnapshot: function (cb, errcb) {
            c.inscritos.push({ cb: cb, lim: lim });
            var tentar = function () {
              c.carregar().then(function () { if (!c.inscritos.length) return; c.iniciarVigia(); if (c.carregada) cb({ docs: c.docs(lim) }); },
                function (e) { if (errcb) errcb(e); setTimeout(tentar, 8000); });
            };
            if (c.carregada) { setTimeout(function () { cb({ docs: c.docs(lim) }); }, 0); c.iniciarVigia(); } else tentar();
            return function () { c.inscritos = c.inscritos.filter(function (s) { return s.cb !== cb; }); };
          } };
        },
        doc: function (id) {
          var did = id || Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
          return { set: function (dados, opcoes) { return escrever(c, did, dados, false, !!(opcoes && opcoes.mesclar)); }, delete: function () { return escrever(c, did, null, true); } };
        },
        add: function (dados) {
          var did = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
          return escrever(c, did, dados, false).then(function () { return { id: did }; });
        }
      };
    }
  };
  /* Salvar arquivo: no iPhone usa a folha de compartilhamento ("Salvar em Arquivos"), que não tira o app da tela.
     Nos demais casos baixa pelo navegador, com um pequeno atraso para o app registrar antes o que precisa. */
  var downloads = { save: function (r) {
    var blob = r.data instanceof Blob ? r.data : new Blob([typeof r.data === 'string' ? r.data : JSON.stringify(r.data)], { type: r.type || 'application/octet-stream' });
    var nome = r.filename || 'arquivo';
    try {
      var arq = new File([blob], nome, { type: blob.type || 'application/octet-stream' });
      if (navigator.canShare && navigator.share && navigator.canShare({ files: [arq] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
        return navigator.share({ files: [arq], title: nome }).then(function () { return { status: 'saved' }; }, function (e) {
          if (e && e.name === 'AbortError') throw { code: 'declined', message: 'Cancelado.' };
          return baixarPeloNavegador(blob, nome);
        });
      }
    } catch (e) { /* cai no download comum */ }
    return baixarPeloNavegador(blob, nome);
  } };
  function baixarPeloNavegador(blob, nome) {
    try {
      var url = URL.createObjectURL(blob);
      setTimeout(function () {
        var a = document.createElement('a'); a.href = url; a.download = nome;
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
      }, 1200);
      return Promise.resolve({ status: 'saved' });
    } catch (e) { return Promise.reject({ code: 'failed', message: String(e) }); }
  }

  /* leitura de foto/PDF: o servidor chama o Claude com a chave guardada lá */
  function paraBase64(blob) {
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1]); }; fr.onerror = function () { rej({ code: 'image_rejected', message: 'Não consegui ler a imagem.' }); }; fr.readAsDataURL(blob); });
  }
  var amostra = null;
  function sample() {
    if (amostra) return Promise.resolve(amostra);
    return EUP.then(function () { return EU.papel !== 'proprietario' ? { ok: false } : fetch('/api/ler/status', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }); }).then(function (j) {
      if (!j || !j.ok) return null;
      var f = function (prompt, opts) {
        opts = opts || {};
        var imgs = opts.images ? (opts.images instanceof Blob ? [opts.images] : Array.prototype.slice.call(opts.images)) : [];
        return Promise.all(imgs.map(function (b) { return paraBase64(b).then(function (d) { return { tipo: b.type || 'image/jpeg', dados: d }; }); })).then(function (lista) {
          return fetch('/api/ler', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: String(prompt), imagens: lista, modelo: opts.modelTier || 'default' }), credentials: 'same-origin', signal: opts.signal })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j2) {
              if (r.status === 401) { location.href = '/login'; }
              if (!r.ok) throw (j2.error || { code: 'unavailable', message: 'Erro ' + r.status });
              if (opts.onText) opts.onText({ text: j2.text, delta: j2.text });
              return { text: j2.text, truncated: false };
            }); }, function (e) { if (e && e.name === 'AbortError') throw { code: 'cancelled', message: 'Cancelado.' }; throw { code: 'unavailable', message: 'Sem conexão com o servidor.' }; });
        });
      };
      f.limits = function () { return Promise.resolve({ maxPromptBytes: 60000, images: { maxCount: 4, maxInputBytes: 20e6, mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } }); };
      amostra = f; return f;
    }).catch(function () { return null; });
  }
  window.claude = { use: function (nome) {
    if (nome === 'sample') return sample();
    if (nome === 'db') return Promise.resolve(db);
    if (nome === 'downloads') return Promise.resolve(downloads);
    return Promise.resolve(null);   // mcp (Google Drive), sample e permissions: ainda não neste servidor
  } };
})();
