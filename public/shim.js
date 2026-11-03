/* Faz o app (que foi feito para rodar dentro do Claude) funcionar neste servidor:
   "claude.use('db')" passa a falar com /api/db (banco D1) e "claude.use('downloads')" baixa o arquivo. */
(function () {
  var colecoes = {};
  function req(metodo, caminho, corpo) {
    return fetch(caminho, { method: metodo, headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined, body: corpo !== undefined ? JSON.stringify(corpo) : undefined, credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) {}
          if (r.status === 401 && j) { location.href = '/login'; }
          if (!r.ok || !j) {
            var e2 = (j && j.error) || { code: r.status === 401 || r.status === 403 ? 'not_granted' : 'unavailable', message: 'Erro ' + r.status };
            throw e2;
          }
          return j;
        });
      }, function () { throw { code: 'unavailable', message: 'Sem conexão com o servidor.' }; });
  }
  function colecao(nome) {
    if (colecoes[nome]) return colecoes[nome];
    var c = colecoes[nome] = { nome: nome, mapa: {}, inscritos: [], carregada: false, pendentes: 0, assinatura: '', timer: null };
    c.docs = function (lim) {
      var ids = Object.keys(c.mapa).sort();
      if (lim) ids = ids.slice(0, lim);
      return ids.map(function (id) { var v = c.mapa[id]; return { id: id, data: function () { return JSON.parse(JSON.stringify(v)); } }; });
    };
    c.avisar = function () { c.inscritos.forEach(function (s) { s.cb({ docs: c.docs(s.lim) }); }); };
    c.carregar = function () {
      return req('GET', '/api/db/' + encodeURIComponent(nome) + '?limit=1000').then(function (j) {
        if (c.pendentes > 0) return;
        var ass = JSON.stringify(j.docs);
        if (c.carregada && ass === c.assinatura) return;
        c.assinatura = ass; c.carregada = true; c.mapa = {};
        j.docs.forEach(function (d) { c.mapa[d.id] = d.data; });
        c.avisar();
      });
    };
    c.iniciarVigia = function () {
      if (c.timer) return;
      c.timer = setInterval(function () { if (!document.hidden) c.carregar().catch(function () {}); }, 15000);
    };
    return c;
  }
  function escrever(c, id, dados, apagar) {
    var antes = c.mapa[id], existia = Object.prototype.hasOwnProperty.call(c.mapa, id);
    if (apagar) delete c.mapa[id]; else c.mapa[id] = JSON.parse(JSON.stringify(dados));
    c.pendentes++; c.avisar();
    var p = apagar ? req('DELETE', '/api/db/' + encodeURIComponent(c.nome) + '/' + encodeURIComponent(id))
                   : req('PUT', '/api/db/' + encodeURIComponent(c.nome) + '/' + encodeURIComponent(id), dados);
    return p.then(function () { c.pendentes--; c.assinatura = ''; }, function (e) {
      c.pendentes--;
      if (existia) c.mapa[id] = antes; else delete c.mapa[id];
      c.avisar(); throw e;
    });
  }
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
          return { set: function (dados) { return escrever(c, did, dados, false); }, delete: function () { return escrever(c, did, null, true); } };
        },
        add: function (dados) {
          var did = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
          return escrever(c, did, dados, false).then(function () { return { id: did }; });
        }
      };
    }
  };
  var downloads = { save: function (r) {
    try {
      var blob = r.data instanceof Blob ? r.data : new Blob([typeof r.data === 'string' ? r.data : JSON.stringify(r.data)], { type: r.type || 'application/octet-stream' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = r.filename || 'arquivo';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return Promise.resolve({ status: 'saved' });
    } catch (e) { return Promise.reject({ code: 'failed', message: String(e) }); }
  } };
  window.claude = { use: function (nome) {
    if (nome === 'db') return Promise.resolve(db);
    if (nome === 'downloads') return Promise.resolve(downloads);
    return Promise.resolve(null);   // mcp (Google Drive), sample e permissions: ainda não neste servidor
  } };
})();
