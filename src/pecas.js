/* ============================================================
   PEÇA SUGERIDA PARA CADA ATO, DESPACHO OU DECISÃO (CPC)
   Este arquivo é usado pelo Worker (src/djen.js) e também é copiado para dentro da página (cliente/montar.py),
   então não pode importar nada. Ele só SUGERE: quem confirma é o advogado.
   Três camadas:
     1. natureza do ato (citação, sentença, decisão, ato ordinatório, despacho, acórdão...), instância (1º grau, Juizado, tribunal)
        e o lado do cliente (autor ou réu), quando a publicação indica;
     2. regras da lei (tabela abaixo): peça, prazo em dias úteis, base legal; Juizado troca os prazos (Lei 9.099); prazo escrito
        no texto vale mais que o prazo-padrão nas manifestações (não nos recursos, que têm prazo de lei); dica de prazo em dobro;
     3. ajuste: a tela deixa trocar a peça, os dias, a contagem e o dobro antes de ir para a Agenda.
   ============================================================ */
function pcNorm(s){ return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }

export var PC_NATUREZA = { citacao: 'Citação', sentenca: 'Sentença', acordao: 'Acórdão', ato: 'Ato ordinatório / certidão', despacho: 'Despacho', decisao: 'Decisão interlocutória', edital: 'Edital', distribuicao: 'Distribuição', outro: 'Outro' };

function pcNatureza(c, t){
  var tipo = pcNorm(c.tipo), com = pcNorm(c.comunic), head = t.slice(0, 700);
  if (/ata de distribui/.test(tipo)) return 'distribuicao';
  if (/senten/.test(tipo) || /\bjulgo (parcialmente )?(procedente|improcedente)|\bjulgo (procedentes?|improcedentes?)|\bextingo o processo|\bhomologo (o )?(acordo|pedido de desist|a desist|a transacao)/.test(head)) return 'sentenca';
  if (/ac[o]rd[a]o/.test(tipo) || /acordam os (senhores )?(desembargadores|ministros|juizes)|negaram provimento|deram provimento|ementa:/.test(t)) return 'acordao';
  if (/citacao/.test(com) || /citacao/.test(tipo) || /\bcite-se\b|\bficam? (o|a|os|as)?\s?(reu|requerido|executado|re|ré)s? citad/.test(head)) return 'citacao';
  if (/ato ordinat|certid/.test(tipo)) return 'ato';
  if (/despacho/.test(tipo)) return 'despacho';
  if (/decis/.test(tipo)) return 'decisao';
  if (/edital/.test(tipo)) return 'edital';
  return 'outro';
}
function pcInstancia(c){
  var org = pcNorm(c.orgao), cls = pcNorm(c.classe), trib = String(c.tribunal || '').toUpperCase();
  if (/juizado|turma recursal/.test(org) || /juizado/.test(cls)) return 'juizado';
  if (/camara|turma|gabinete|desembargador|secao civel|corte especial|tribunal pleno|presidencia|ministro|relator/.test(org) || /^(STJ|STF|TST|TSE|STM)$/.test(trib)) return 'tribunal';
  return 'primeiro';
}
function pcPolo(dest){
  var s = {}, n = 0; (dest || []).forEach(function(d){ if (d && (d.p === 'A' || d.p === 'P') && !s[d.p]){ s[d.p] = 1; n++; } });
  return n === 1 ? (s.A ? 'A' : 'P') : '';
}
var PC_FAZENDA = /fazenda|estado d[eo] |municipio|\buniao\b|\binss\b|instituto nacional do seguro|autarquia|defensoria|ministerio publico|procuradoria/;

var PC_REGRAS = [];
function pcR(id, o, itens, nota){ var r = { id: id }; for (var k in o) r[k] = o[k]; r.itens = itens; r.nota = nota || ''; PC_REGRAS.push(r); }
function pcI(peca, dias, base, extra){ var i = { peca: peca, dias: dias, base: base, kind: 'manif' }; for (var k in (extra || {})) i[k] = extra[k]; return i; }
var PC_REC = { kind: 'recurso' }, PC_ALT = { alt: true };
var PC_DECIDE = /(indefiro|indeferida|indeferido|rejeito|rejeitada|nego |nao defiro|nao concedo|revogo|cassa|defiro|deferida|concedo|acolho|afasto|julgo)/;
var PC_NEGA = /(indefiro|indeferida|indeferido|rejeito|rejeitada|nego |nao defiro|nao concedo|revogo|cassa|nao acolho|afasto)/;
var PC_NOTA_1015 = 'As hipóteses do art. 1.015 do CPC são a regra; o STJ admite agravo fora delas só em caso de urgência (Tema 988). Se não couber, registre para a apelação (CPC 1.009, §1º).';

/* ---- conhecimento ---- */
pcR('contestar', { nat: ['citacao'], polo: 'P', nre: /execucao de titulo extrajudicial|embargos de terceiro/, prio: 20 },
  [pcI('Contestação', 15, 'CPC 335'), pcI('Reconvenção (junto com a contestação)', 15, 'CPC 343', PC_ALT)],
  'Se houver audiência de conciliação ou mediação designada, o prazo da contestação conta dela (CPC 335, I): confira.');
pcR('exec-extra', { nat: ['citacao'], polo: 'P', re: /execucao/, prio: 25 },
  [pcI('Embargos à execução', 15, 'CPC 915'), pcI('Pagamento em 3 dias (honorários reduzidos pela metade)', 3, 'CPC 827, §1º e 829', PC_ALT), pcI('Parcelamento (30% de entrada + até 6 parcelas)', 15, 'CPC 916', PC_ALT)],
  'O prazo dos embargos conta da juntada do mandado de citação (CPC 915).');
pcR('cumpr-pagar', { polo: 'P', re: /(pagar|pagamento|cumprimento de sentenca).{0,140}(15|quinze) dias|art\.? ?523|intim.{0,60}(executad|devedor).{0,80}pag/, nre: /impugnacao.{0,60}(rejeit|indefer|improced)/, prio: 22 },
  [pcI('Pagamento voluntário', 15, 'CPC 523'), pcI('Impugnação ao cumprimento de sentença', 15, 'CPC 525', { kind: 'manif', alt: true, nota: 'conta depois de terminado o prazo de pagamento' })],
  'Não pagando em 15 dias há multa de 10% e honorários de 10% (CPC 523, §1º).');
pcR('exeq-bens', { polo: 'A', re: /indicar (bens|o endereco)|bens penhoraveis|requerer o que (de )?direito|dar prosseguimento|prosseguimento (do feito|da execucao)/, prio: 12 },
  [pcI('Petição de prosseguimento (indicar bens / requerer penhora)', 'texto', 'CPC 218, §3º')]);
pcR('abandono', { re: /abandono|art\.? ?485.{0,8}§ ?1|dar andamento ao feito.{0,50}5|intimacao pessoal.{0,70}(dar andamento|prosseguir)/, prio: 30 },
  [pcI('Petição dando andamento ao feito (evita extinção por abandono)', 5, 'CPC 485, §1º')], 'A intimação é pessoal para a parte: avise o cliente hoje.');
pcR('replica-prelim', { nat: ['ato', 'despacho', 'decisao'], polo: 'A', re: [/contestacao/, /preliminar|inepcia|ilegitimidade|falta de interesse|carencia de acao/, /impugn|replic|manifest|falar|dizer|vista|prazo/], nre: /reconvencao/, prio: 26 },
  [pcI('Réplica com manifestação sobre as preliminares', 15, 'CPC 338 e 351'), pcI('Réplica (impugnação à contestação)', 15, 'CPC 350 e 351', PC_ALT)]);
pcR('replica', { nat: ['ato', 'despacho', 'decisao'], polo: 'A', re: /(impugnar|replic|manifestar|manifest|falar|dizer|vista).{0,80}contestacao|contestacao.{0,100}(impugn|replic|manifest|vista)|prazo para replica/, nre: /reconvencao/, prio: 20 },
  [pcI('Réplica (impugnação à contestação)', 15, 'CPC 350 e 351'), pcI('Especificação de provas', 'texto', 'CPC 218, §3º', PC_ALT), pcI('Manifestação simples', 'texto', 'CPC 218, §3º', PC_ALT)]);
pcR('recon', { polo: 'A', re: [/reconvencao/, /contest|impugn|manifest|resposta|prazo/], prio: 27 },
  [pcI('Contestação à reconvenção', 15, 'CPC 343, §1º')]);
pcR('emenda', { re: /emend(ar|e|a)\b.{0,40}(inicial|peticao)|emenda a inicial|art\.? ?321|complementar a inicial|sob pena de indeferimento da inicial/, prio: 24 },
  [pcI('Emenda à inicial', 15, 'CPC 321')]);
pcR('documentos', { re: /(manifest|falar|dizer|ciencia).{0,70}documentos? (juntad|acostad|apresentad)|documentos? (juntad|acostad).{0,70}(manifest|prazo)|art\.? ?437/, prio: 18 },
  [pcI('Manifestação sobre os documentos juntados', 15, 'CPC 437, §1º')]);
pcR('laudo', { re: /(manifest|ciencia|vista|prazo).{0,70}laudo|laudo.{0,90}(manifest|ciencia|vista|esclarecimento)|esclarecimentos do perito/, prio: 20 },
  [pcI('Manifestação sobre o laudo pericial', 15, 'CPC 477, §1º')]);
pcR('perito', { re: /nomeio.{0,60}perit|nomeacao d[eo] perit|indicar? assistentes? tecnic|apresentar quesitos|art\.? ?465/, prio: 20 },
  [pcI('Quesitos, assistente técnico e eventual arguição de impedimento do perito', 15, 'CPC 465, §1º')]);
pcR('honor-pericial', { re: /honorarios periciais|honorarios do perito|proposta de honorarios|depositar.{0,40}honorarios/, prio: 14 },
  [pcI('Manifestação sobre os honorários periciais / depósito', 'texto', 'CPC 95 e 465, §3º')]);
pcR('saneamento', { nat: ['decisao', 'despacho'], re: /saneamento|organizacao do processo|pontos controvertidos|fixo os pontos/, prio: 16 },
  [pcI('Pedido de esclarecimentos ou ajustes (saneamento)', 5, 'CPC 357, §1º'), pcI('Rol de testemunhas', 'texto', 'CPC 357, §4º', { kind: 'manif', alt: true, se: /testemunh/ }), pcI('Especificação de provas', 'texto', 'CPC 218, §3º', { kind: 'manif', alt: true, se: /prova/ })]);
pcR('provas', { re: /especificar (as )?provas|especificacao de provas|provas que pretend|pretende produzir provas|dizer se tem provas/, prio: 15 },
  [pcI('Especificação de provas', 'texto', 'CPC 218, §3º')]);
pcR('rol', { re: /rol de testemunhas/, prio: 14 }, [pcI('Rol de testemunhas', 'texto', 'CPC 357, §4º')]);

/* ---- sentença e recursos ---- */
pcR('sentenca', { nat: ['sentenca'], inst: ['primeiro', 'juizado'], nre: /homologo (o )?(acordo|transacao)|homologo.{0,25}desist/, prio: 30, ajuste: 'sentenca' },
  [pcI('Apelação', 15, 'CPC 1.009 e 1.003, §5º', PC_REC), pcI('Embargos de declaração', 5, 'CPC 1.023', { kind: 'recurso', alt: true }), pcI('Contrarrazões de apelação (se a outra parte apelar)', 15, 'CPC 1.010, §1º', { kind: 'recurso', alt: true })],
  'Confira o resultado para o seu cliente: apelar, esperar a apelação da outra parte (contrarrazões) ou recurso adesivo (CPC 997, §1º).');
pcR('sentenca-homolog', { nat: ['sentenca'], re: /homologo (o )?(acordo|transacao)|homologo.{0,25}desist/, prio: 36 },
  [pcI('Acompanhar trânsito em julgado e cumprimento do acordo (sem recurso, em regra)', null, 'CPC 1.000', { kind: 'registro' }), pcI('Embargos de declaração (só se houver omissão)', 5, 'CPC 1.023', { kind: 'recurso', alt: true })]);
pcR('tutela-nega', { nat: ['decisao', 'despacho'], inst: ['primeiro', 'juizado'], polo: 'A', re: [/tutela (de urgencia|provisoria|antecipada|de evidencia)|antecipacao de tutela|\bliminar\b|\bliminares\b/, PC_NEGA], agravo: true, prio: 32 },
  [pcI('Agravo de instrumento', 15, 'CPC 1.015, I', PC_REC)], PC_NOTA_1015);
pcR('tutela-defere', { nat: ['decisao', 'despacho'], inst: ['primeiro', 'juizado'], polo: 'P', re: [/tutela (de urgencia|provisoria|antecipada|de evidencia)|antecipacao de tutela|\bliminar\b|\bliminares\b/, /(defiro|deferida|concedo|concedida)/], nre: /(indefiro|nao defiro|nao concedo)/, agravo: true, prio: 32 },
  [pcI('Agravo de instrumento (contra a tutela deferida)', 15, 'CPC 1.015, I', PC_REC), pcI('Cumprimento da tutela / manifestação', 'texto', 'CPC 218, §3º', { kind: 'manif', alt: true })], PC_NOTA_1015);
pcR('incompetencia', { nat: ['decisao', 'despacho'], re: [/incompetenc/, /(rejeit|afast|indefir|nao acolh|improced)/], agravo: true, prio: 30 },
  [pcI('Agravo de instrumento', 15, 'CPC 1.015, III', PC_REC)], PC_NOTA_1015);
pcR('gratuidade', { nat: ['decisao', 'despacho'], re: [/(justica gratuita|gratuidade)/, /(indefiro|defiro|revogo|concedo|rejeito|nego |cancelo|indeferida|deferida)/], agravo: true, prio: 30 },
  [pcI('Agravo de instrumento', 15, 'CPC 1.015, V', PC_REC)], PC_NOTA_1015);
pcR('grat-impugn', { re: /impugna(cao|ram|u|da).{0,50}(gratuidade|justica gratuita)|(gratuidade|justica gratuita).{0,70}impugna/, nre: /(indefiro|defiro|revogo|concedo|rejeito|nego |cancelo)/, prio: 28 },
  [pcI('Manifestação sobre a impugnação à gratuidade (com provas de hipossuficiência)', 15, 'CPC 100')]);
pcR('litisconsorte', { nat: ['decisao', 'despacho'], re: /(excluo|exclusao d[eo]|exclu[i]d[oa]s?|exclui).{0,50}(litisconsor|co-?r[eé]u|do polo|da lide)/, agravo: true, prio: 30 },
  [pcI('Agravo de instrumento', 15, 'CPC 1.015, VII', PC_REC)], PC_NOTA_1015);
pcR('onus-prova', { nat: ['decisao', 'despacho'], re: /distribuicao dinamica|inversao do onus|redistribu.{0,20}onus|onus da prova.{0,60}(parte|autor|reu)/, agravo: true, prio: 18 },
  [pcI('Agravo de instrumento', 15, 'CPC 1.015, XI c/c 373, §4º', PC_REC)], PC_NOTA_1015);
pcR('outras-1015', { nat: ['decisao', 'despacho'], re: [/(convencao de arbitragem|exibicao ou posse de documento|intervencao de terceiros|efeito suspensivo.{0,30}embargos a execucao)/, PC_DECIDE], agravo: true, prio: 17 },
  [pcI('Agravo de instrumento', 15, 'CPC 1.015 (incisos II, VI, VIII ou X)', PC_REC)], PC_NOTA_1015);
pcR('idpj-decisao', { nat: ['decisao', 'despacho'], re: [/desconsideracao da personalidade/, /(acolho|rejeito|indefiro|defiro|julgo) .{0,40}(incidente|pedido de desconsideracao|desconsideracao)/], agravo: true, prio: 31 },
  [pcI('Agravo de instrumento', 15, 'CPC 1.015, IV', PC_REC)], PC_NOTA_1015);
pcR('idpj', { re: [/desconsideracao da personalidade/, /(cit|intim|manifest|prazo|instaur|suscit)/], nre: /(acolho|rejeito|indefiro|defiro|julgo) .{0,40}(incidente|pedido de desconsideracao|desconsideracao)/, prio: 24 },
  [pcI('Manifestação ou defesa, com especificação de provas (IDPJ)', 15, 'CPC 135')]);
pcR('suspeicao', { re: /(impedimento|suspeicao).{0,90}(arguid|excecao|oposta|alegad|requeri)|excecao de (impedimento|suspeicao)|arguicao de (impedimento|suspeicao)/, nre: /impedimento.{0,30}perit/, prio: 22 },
  [pcI('Resposta à arguição de impedimento/suspeição', 15, 'CPC 146, §1º')]);
pcR('emb-terceiro', { re: [/embargos de terceiro/, /(contest|citad|cite|intim|prazo)/], prio: 30 },
  [pcI('Contestação aos embargos de terceiro', 15, 'CPC 683')]);
pcR('obrig-fazer', { re: /obrigacao de (fazer|nao fazer)|astreinte|multa (diaria|cominatoria)|sob pena de multa|cumpra.{0,50}sob pena/, nat: ['decisao', 'despacho', 'ato'], prio: 20 },
  [pcI('Comprovação do cumprimento (ou justificativa de impossibilidade)', 'texto', 'CPC 536 e 537')]);
pcR('contraminuta', { re: /contraminuta|resposta ao agravo|responder ao agravo|intim.{0,70}agravo de instrumento|agravo de instrumento.{0,70}(intim|prazo)/, prio: 26 },
  [pcI('Contraminuta do agravo de instrumento', 15, 'CPC 1.019, II', PC_REC)]);
pcR('contrarrazoes', { re: /contrarrazoes|contra-razoes|apresentar.{0,30}razoes|apelacao.{0,70}(intim|prazo|contrarraz)|(intim|prazo).{0,70}apelacao/, nre: /contraminuta/, prio: 26 },
  [pcI('Contrarrazões de apelação', 15, 'CPC 1.010, §1º', PC_REC)]);
pcR('ed-contra', { nat: ['decisao', 'despacho', 'ato'], re: /embargos de declaracao.{0,110}(manifest|contraditorio|intim|prazo|vista)|(manifest|vista|contraditorio).{0,70}embargos de declaracao/, prio: 26 },
  [pcI('Manifestação sobre os embargos de declaração', 5, 'CPC 1.023, §2º')]);
pcR('acordao', { nat: ['acordao'], prio: 30, esc: true },
  [pcI('Embargos de declaração', 5, 'CPC 1.023', PC_REC), pcI('Recurso especial / extraordinário', 15, 'CPC 1.029 e 1.003, §5º', PC_REC), pcI('Contrarrazões (se a outra parte recorrer)', 15, 'CPC 1.030', PC_REC)],
  'A peça depende do resultado para o seu cliente. Havendo omissão, os embargos vêm antes do recurso especial/extraordinário (prequestionamento).');
pcR('monocratica', { nat: ['decisao', 'despacho'], inst: ['tribunal'], re: /(nego|dou) provimento|nao conheco d[eo]|julgo (prejudicado|extinto)|decisao monocratica|monocratic/, prio: 30 },
  [pcI('Agravo interno', 15, 'CPC 1.021, §2º e 1.003, §5º', PC_REC), pcI('Embargos de declaração', 5, 'CPC 1.023', { kind: 'recurso', alt: true })]);
pcR('pauta', { inst: ['tribunal'], re: /pauta|sessao de julgamento|sustentacao oral|julgamento (virtual|presencial)/, prio: 20 },
  [pcI('Acompanhar a sessão / pedir sustentação oral', null, 'veja o prazo no regimento do tribunal', { kind: 'registro' })]);

/* ---- atos de secretaria e fase satisfativa ---- */
pcR('retorno', { re: /retorno dos autos|autos (retornaram|baixaram|devolvidos)|baixa dos autos|ciencia (do|da) (retorno|baixa)|retornaram da instancia superior/, prio: 24 },
  [pcI('Requerimento de cumprimento do acórdão / pedido de baixa e arquivamento', 15, 'CPC 512 ou 1.050')]);
pcR('vista', { nat: ['ato', 'despacho'], re: /vista dos autos|abertura de vista|vista (a|para) (a )?parte|abre-se vista|vista para (manifestacao|ciencia)/, prio: 13 },
  [pcI('Petição de juntada, pedido de vista ou ciência', 'texto', 'CPC 203, §4º')]);
pcR('representacao', { re: /regulariz(ar|acao).{0,50}representacao|procuracao|substabelecimento|instrumento de mandato|art\.? ?76/, prio: 25 },
  [pcI('Juntada de procuração, substabelecimento ou declaração', 'texto', 'CPC 76', { kind: 'manif', padrao: 5 })]);
pcR('decurso', { nat: ['ato'], re: /decurso (de )?prazo|decorreu o prazo|transcorr(eu|ido) o prazo|prazo transcorreu|(sem|nao houve) manifestacao|nao se manifestou|deixou transcorrer/, prio: 25 },
  [pcI('Petição requerendo o prosseguimento', 5, 'CPC 218, §3º'), pcI('Requerer a decretação de revelia (se o réu não contestou)', 5, 'CPC 344 e 218, §3º', { kind: 'manif', alt: true }), pcI('Pedir a certidão de trânsito em julgado', 5, 'CPC 218, §3º', { kind: 'manif', alt: true })]);
pcR('calculos', { re: /(contadoria|calculos?|planilha|memoria de calculo|conta judicial).{0,110}(manifest|impugn|prazo|ciencia|vista|intim)|(manifest|impugn|vista).{0,90}(calculos?|contadoria)/, prio: 22 },
  [pcI('Impugnação aos cálculos ou concordância expressa', 15, 'CPC 524, §2º')]);
pcR('impug-cumpr-rejeitada', { re: [/impugnacao.{0,90}cumprimento|cumprimento.{0,90}impugnacao/, /(rejeito|indefiro|julgo improcedente|nao acolho|acolho em parte|acolho)/], agravo: true, prio: 35, ajuste: 'cumprimento' },
  [pcI('Agravo de instrumento (se a execução continua)', 15, 'CPC 1.015, par. único c/c 1.009', PC_REC), pcI('Apelação (se o processo foi extinto)', 15, 'CPC 1.009', PC_REC)]);
pcR('penhora-exec', { polo: 'P', re: [/sisbajud|bacenjud|renajud|infojud|penhora|constricao|bloqueio|indisponibilidade|registro de imoveis/, /intim|ciencia|prazo|manifest/], prio: 28 },
  [pcI('Manifestação sobre o bloqueio (impenhorabilidade ou excesso)', 5, 'CPC 854, §3º', { kind: 'manif', se: /sisbajud|bacenjud|bloqueio|indisponib/ }), pcI('Impugnação à penhora', 15, 'CPC 525, §11', { kind: 'manif', alt: true })],
  'O prazo para provar impenhorabilidade ou excesso do bloqueio é de 5 dias (CPC 854, §3º); a impugnação à penhora tem 15 dias.');
pcR('penhora-exeq', { polo: 'A', re: [/sisbajud|bacenjud|bloqueio|indisponibilidade/, /intim|ciencia|prazo|manifest|requerer/], prio: 26 },
  [pcI('Requerer a transferência do valor bloqueado / converter em penhora', 'texto', 'CPC 854, §5º')]);
pcR('leilao', { re: [/leilao|praca|arrematacao|adjudicacao|avaliacao do bem|auto de (arrematacao|adjudicacao)/, /intim|publicacao|edital|ciencia|prazo|manifest/], prio: 27 },
  [pcI('Manifestação quanto ao valor da avaliação', 10, 'CPC 903, §2º'), pcI('Embargos à arrematação / pedido de invalidação', 10, 'CPC 903, §2º', { kind: 'manif', alt: true, se: /arrematacao|adjudicacao/ })],
  'Se o juiz fixar outro prazo no texto, vale o do texto.');
pcR('custas', { nat: ['ato', 'despacho'], re: /(recolh(er|imento)|custas|preparo|taxa judiciaria|depositar|deposito)/, prio: 14 },
  [pcI('Cumprimento da determinação (recolher custas / providenciar diligência)', 'texto', 'prazo do texto')]);
pcR('manifeste-se', { nat: ['despacho', 'ato', 'decisao'], sozinha: true, re: /manifest(e|em|ar)-?se|\bdiga\b|\bdigam\b|\bdizer\b|requeira|requerer o que|tomar ciencia/, prio: 2 },
  [pcI('Manifestação', 'texto', 'CPC 218, §3º')]);

function pcCasa(r, c){
  if (r.nat && r.nat.indexOf(c.nat) < 0) return false;
  if (r.inst && r.inst.indexOf(c.inst) < 0) return false;
  if (r.polo && c.polo && c.polo !== r.polo) return false;
  var res = r.re ? (r.re instanceof Array ? r.re : [r.re]) : [];
  for (var i = 0; i < res.length; i++) if (!res[i].test(c.t)) return false;
  if (r.nre && r.nre.test(c.t)) return false;
  return true;
}

/* ctx: { tipo, comunic, classe, orgao, tribunal, texto, dest: [{n, p}], diasTexto: { dias, tipo } } */
export function sugerirPecas(ctx){
  var t = pcNorm(ctx.texto || ''), c = { tipo: ctx.tipo, comunic: ctx.comunic, classe: ctx.classe, orgao: ctx.orgao, tribunal: ctx.tribunal, t: t };
  c.nat = pcNatureza(c, t); c.inst = pcInstancia(c); c.polo = pcPolo(ctx.dest);
  var dt = ctx.diasTexto && ctx.diasTexto.dias ? ctx.diasTexto : null;
  var hits = PC_REGRAS.filter(function(r){ return pcCasa(r, c); }).sort(function(a, b){ return (b.prio || 0) - (a.prio || 0); });
  if (hits.length > 1) hits = hits.filter(function(r){ return !r.sozinha; });   /* o “manifeste-se” genérico só entra quando nada mais casou */
  var itens = [], vistos = {}, avisos = [], principalDado = false, temAgravo = false;
  hits.forEach(function(r, ri){
    if (r.agravo) temAgravo = true;
    if (r.nota && avisos.indexOf(r.nota) < 0) avisos.push(r.nota);
    var lista = r.itens.slice();
    if (r.ajuste === 'sentenca') lista = pcAjusteSentenca(lista, c);
    if (r.ajuste === 'cumprimento') lista = pcAjusteCumprimento(lista, t);
    lista.forEach(function(it, ii){
      if (it.se && !it.se.test(t)) return;
      var chave = it.peca + '|' + it.base; if (vistos[chave]) return; vistos[chave] = 1;
      var x = { rid: r.id, peca: it.peca, base: it.base, kind: it.kind || 'manif', nota: it.nota || '', dias: it.dias, contagem: 'uteis', origemPrazo: 'lei', principal: false };
      if (x.dias === 'texto'){ x.dias = dt ? dt.dias : (it.padrao || 5); x.origemPrazo = dt ? 'texto' : 'supletivo'; if (dt && dt.tipo === 'corridos') x.contagem = 'corridos'; }
      else if (x.dias && x.kind === 'manif' && dt && dt.dias !== x.dias){ x.nota = (x.nota ? x.nota + '; ' : '') + 'o texto fixa ' + dt.dias + ' dias (a lei prevê ' + x.dias + ')'; x.dias = dt.dias; x.origemPrazo = 'texto'; if (dt.tipo === 'corridos') x.contagem = 'corridos'; }
      if (!principalDado && ri === 0 && ii === 0 && !r.esc && !it.alt){ x.principal = true; principalDado = true; }
      itens.push(x);
    });
  });
  if (c.nat === 'decisao' && c.inst === 'primeiro' && !temAgravo && !itens.some(function(i){ return i.kind === 'recurso'; })){
    itens.push({ rid: 'interlocutoria', peca: 'Registrar para futura preliminar de apelação ou contrarrazões', base: 'CPC 1.009, §1º', kind: 'registro', nota: 'Decisão interlocutória sem agravo imediato: não há prazo agora.', dias: null, contagem: 'uteis', origemPrazo: 'lei', principal: !principalDado });
    itens.push({ rid: 'interlocutoria', peca: 'Embargos de declaração (só se houver omissão, contradição ou obscuridade)', base: 'CPC 1.023', kind: 'recurso', nota: '', dias: 5, contagem: 'uteis', origemPrazo: 'lei', principal: false });
    if (!principalDado) principalDado = true;
  }
  if (c.inst === 'juizado') itens = pcJuizado(itens);
  itens = itens.slice(0, 7);
  var donoDobro = (ctx.dest || []).filter(function(d){ return d && (!c.polo || d.p === c.polo) && PC_FAZENDA.test(pcNorm(d.n)); })[0];
  if (!itens.length && !c.polo && c.nat === 'outro') return null;
  return { natureza: c.nat, instancia: c.inst, polo: c.polo, feats: pcFeatures(c, t).slice(0, 40), itens: itens, avisos: avisos.slice(0, 3), dobro: (donoDobro && c.inst !== 'juizado') ? 'fazenda' : '', diasTexto: dt ? dt.dias : 0 };
}

/* ---- aprendizado: o "jeito do ato" (natureza, instância, lado do cliente, verbos e palavras-chave do texto) ---- */
var PC_PALAVRAS = ['tutela', 'liminar', 'gratuidade', 'incompetenc', 'litisconsor', 'onus da prova', 'desconsideracao', 'suspeicao', 'impedimento', 'embargos de terceiro', 'reconvencao', 'contestacao', 'replica', 'preliminar', 'laudo', 'perit', 'saneamento', 'testemunh', 'provas', 'emenda', 'documentos', 'calculos', 'contadoria', 'penhora', 'sisbajud', 'renajud', 'infojud', 'bloqueio', 'leilao', 'arrematacao', 'avaliacao', 'cumprimento de sentenca', 'impugnacao', 'execucao', 'embargos de declaracao', 'apelacao', 'agravo', 'contrarrazoes', 'custas', 'recolh', 'diligencia', 'prevjud', 'procuracao', 'substabelecimento', 'vista', 'decurso', 'revelia', 'abandono', 'honorarios', 'multa', 'astreinte', 'obrigacao de fazer', 'alvara', 'acordo', 'homolog', 'desist', 'transito em julgado', 'prescri', 'extin', 'audiencia', 'conciliacao', 'mediacao', 'pagamento', 'sustentacao', 'pauta', 'retorno', 'oficial de justica', 'inventario', 'alimentos', 'guarda', 'usucapiao', 'despejo', 'busca e apreensao'];
var PC_VERBOS = ['indefiro', 'defiro', 'rejeito', 'acolho', 'julgo procedente', 'julgo improcedente', 'parcialmente procedente', 'nego provimento', 'dou provimento', 'homologo', 'extingo', 'determino', 'intime-se', 'cite-se', 'certifico', 'designo', 'nomeio'];
export function pcFeatures(c, t){
  var f = ['n:' + c.nat, 'i:' + c.inst]; if (c.polo) f.push('p:' + c.polo);
  PC_VERBOS.forEach(function(v){ if (t.indexOf(v) >= 0) f.push('v:' + v); });
  PC_PALAVRAS.forEach(function(k){ if (t.indexOf(k) >= 0) f.push('k:' + k); });
  return f;
}
export function pcJaccard(a, b){
  var sa = {}, n = 0, u = 0, k; (a || []).forEach(function(x){ sa[x] = 1; });
  var sb = {}; (b || []).forEach(function(x){ sb[x] = 1; });
  for (k in sa){ u++; if (sb[k]) n++; } for (k in sb) if (!sa[k]) u++;
  return u ? n / u : 0;
}
/* sentença: o que fazer depende de quem ganhou */
function pcAjusteSentenca(lista, c){
  var res = /parcialmente (procedente|procedentes)|procedencia parcial/.test(c.t) ? 'parcial' : (/improcedente/.test(c.t) ? 'improcedente' : (/procedente/.test(c.t) ? 'procedente' : ''));
  var venceu = (c.polo === 'A' && res === 'procedente') || (c.polo === 'P' && res === 'improcedente');
  if (venceu){
    var ap = lista[0], ed = lista[1], cr = lista[2];
    return [{ peca: cr.peca, dias: cr.dias, base: cr.base, kind: 'recurso' }, { peca: 'Apelação (só se houver sucumbência, p. ex. honorários)', dias: ap.dias, base: ap.base, kind: 'recurso', alt: true }, ed];
  }
  return lista;
}
function pcAjusteCumprimento(lista, t){ return /extin/.test(t) ? [lista[1], lista[0]] : lista; }
/* Juizado Especial: prazos da Lei 9.099 */
function pcJuizado(itens){
  var out = [];
  itens.forEach(function(i){
    var x = {}; for (var k in i) x[k] = i[k];
    if (/^Apelação/.test(x.peca)){ x.peca = 'Recurso inominado'; x.dias = 10; x.base = 'Lei 9.099, art. 42'; }
    else if (/^Contrarrazões de apelação/.test(x.peca)){ x.peca = 'Contrarrazões ao recurso inominado'; x.dias = 10; x.base = 'Lei 9.099, art. 42, §2º'; }
    else if (/^Embargos de declaração/.test(x.peca)){ x.base = 'Lei 9.099, art. 49'; x.dias = 5; }
    else if (/^Agravo de instrumento/.test(x.peca)){ x = { rid: x.rid, peca: 'Registrar: no Juizado não cabe agravo de instrumento (avaliar mandado de segurança)', base: 'Enunciado 15 do FONAJE', kind: 'registro', nota: '', dias: null, contagem: 'uteis', origemPrazo: 'lei', principal: x.principal }; }
    out.push(x);
  });
  return out;
}
