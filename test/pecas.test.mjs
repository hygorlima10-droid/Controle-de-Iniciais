// Testa o motor de peças sugeridas (src/pecas.js): natureza do ato, instância, lado do cliente, regras do CPC, Juizado e prazo do texto.
//   node test/pecas.test.mjs
import { sugerirPecas } from '../src/pecas.js';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const A = [{ n: 'Cliente', p: 'A' }], P = [{ n: 'Cliente', p: 'P' }];
const run = (tipo, texto, o = {}) => sugerirPecas({ tipo, texto, dest: o.dest || A, orgao: o.orgao || 'Morrinhos - 1ª Vara Cível', classe: o.classe || 'PROCEDIMENTO COMUM', tribunal: o.tribunal || 'TJGO', comunic: o.comunic || 'Intimação', diasTexto: o.diasTexto || null });
const pecas = r => (r ? r.itens.map(i => i.peca) : []);
const tem = (r, trecho) => pecas(r).some(p => p.includes(trecho));
const it = (r, trecho) => (r ? r.itens.find(i => i.peca.includes(trecho)) : null);
const princ = r => (r && r.itens.find(i => i.principal)) || null;

// --- conhecimento
let r = run('Ato ordinatório', 'Certifico que a contestação foi juntada. Intime-se a parte autora para, no prazo de 15 (quinze) dias, impugnar a contestação e especificar provas.');
check(princ(r) && princ(r).peca.startsWith('Réplica') && princ(r).dias === 15 && princ(r).base === 'CPC 350 e 351', 'intimação para impugnar a contestação → réplica, 15 dias, CPC 350/351');
check(r.natureza === 'ato' && r.polo === 'A' && r.instancia === 'primeiro', 'classifica: ato ordinatório, cliente autor, 1º grau');
r = run('Ato ordinatório', 'Intime-se a parte autora para manifestar-se sobre a contestação, que traz preliminar de ilegitimidade passiva e inépcia da inicial, no prazo de 15 dias.');
check(princ(r).peca.includes('preliminares') && princ(r).base === 'CPC 338 e 351', 'contestação com preliminares → réplica focada nas preliminares (CPC 338 e 351)');
r = run('Citação', 'Cite-se o réu para, querendo, contestar a ação no prazo de 15 dias.', { dest: P, comunic: 'Citação' });
check(princ(r).peca === 'Contestação' && princ(r).dias === 15 && princ(r).base === 'CPC 335', 'citação do cliente réu → contestação, 15 dias, CPC 335');
r = run('Citação', 'Cite-se o réu para contestar. Designo audiência de conciliação para 10/03/2027.', { dest: P, comunic: 'Citação' });
check(r.avisos.some(a => /335, I/.test(a)), 'com audiência de conciliação: avisa que o prazo da contestação conta dela');
r = run('Citação', 'Cite-se o executado para pagar em 3 dias ou opor embargos à execução de título extrajudicial.', { dest: P, comunic: 'Citação', classe: 'EXECUÇÃO DE TÍTULO EXTRAJUDICIAL' });
check(princ(r).peca === 'Embargos à execução' && princ(r).base === 'CPC 915' && tem(r, 'Parcelamento') && tem(r, 'Pagamento em 3 dias'), 'citação em execução (executado) → embargos (915), com pagamento em 3 dias e parcelamento (916)');
r = run('Despacho', 'Intime-se a parte autora para emendar a inicial, no prazo de 15 dias, sob pena de indeferimento (art. 321 do CPC).');
check(princ(r).peca === 'Emenda à inicial' && princ(r).base === 'CPC 321', 'emenda à inicial (CPC 321)');
r = run('Despacho', 'Intimem-se as partes para manifestarem-se sobre os documentos juntados pela parte contrária, em 15 dias.');
check(tem(r, 'documentos juntados') && it(r, 'documentos juntados').base === 'CPC 437, §1º', 'documentos juntados → manifestação (CPC 437, §1º)');
r = run('Despacho', 'Intimem-se as partes para se manifestarem sobre o laudo pericial no prazo de 15 dias.');
check(tem(r, 'laudo pericial') && it(r, 'laudo pericial').base === 'CPC 477, §1º', 'laudo pericial → manifestação (CPC 477, §1º)');
r = run('Decisão', 'Nomeio perito o Sr. Fulano. As partes poderão arguir impedimento, apresentar quesitos e indicar assistentes técnicos em 15 dias (art. 465, §1º).');
check(tem(r, 'Quesitos'), 'nomeação de perito → quesitos, assistente técnico e impedimento (CPC 465, §1º)');
r = run('Decisão', 'Em saneamento, fixo os pontos controvertidos e defiro a prova testemunhal; apresentem o rol de testemunhas.');
check(princ(r).peca.includes('saneamento') && princ(r).dias === 5 && tem(r, 'Rol de testemunhas'), 'saneamento → esclarecimentos em 5 dias (357, §1º) + rol de testemunhas');
r = run('Despacho', 'Especifiquem as partes as provas que pretendem produzir, em 5 dias.', { diasTexto: { dias: 5, tipo: 'uteis' } });
check(princ(r).peca === 'Especificação de provas' && princ(r).dias === 5 && princ(r).origemPrazo === 'texto', 'especificar provas → prazo do texto');
r = run('Despacho', 'Especifiquem as partes as provas que pretendem produzir.');
check(princ(r).dias === 5 && princ(r).origemPrazo === 'supletivo', 'sem prazo no texto → supletivo de 5 dias (CPC 218, §3º)');
r = run('Despacho', 'Intime-se o autor para contestar a reconvenção no prazo de 15 dias.');
check(tem(r, 'Contestação à reconvenção') && it(r, 'reconvenção').base === 'CPC 343, §1º', 'reconvenção → contestação à reconvenção (343, §1º)');
r = run('Ato ordinatório', 'Certifico que a parte autora foi intimada pessoalmente para dar andamento ao feito em 5 dias, sob pena de extinção por abandono (art. 485, §1º).');
check(tem(r, 'evita extinção por abandono') && r.avisos.some(a => /pessoal/.test(a)), 'abandono (CPC 485, §1º): peça de andamento e aviso de intimação pessoal');
r = run('Despacho', 'Intime-se a parte para, sob pena de multa diária, cumprir a obrigação de fazer no prazo de 10 dias.', { diasTexto: { dias: 10, tipo: 'uteis' } });
check(princ(r).peca.includes('Comprovação do cumprimento') && princ(r).dias === 10 && princ(r).base === 'CPC 536 e 537', 'obrigação de fazer sob multa → comprovação de cumprimento (536/537), prazo do texto');

// --- sentença e recursos
r = run('Sentença', 'Ante o exposto, julgo IMPROCEDENTES os pedidos formulados. Condeno o autor em custas.');
check(princ(r).peca === 'Apelação' && princ(r).dias === 15 && princ(r).base === 'CPC 1.009 e 1.003, §5º' && tem(r, 'Embargos de declaração'), 'sentença improcedente (cliente autor) → apelação 15 dias, com ED 5 dias');
r = run('Sentença', 'Julgo procedentes os pedidos iniciais, condenando o réu.');
check(princ(r).peca.startsWith('Contrarrazões') && tem(r, 'Apelação (só se houver sucumbência'), 'cliente venceu → contrarrazões como principal e apelação só para sucumbência');
r = run('Sentença', 'Julgo parcialmente procedentes os pedidos.');
check(princ(r).peca === 'Apelação', 'procedência parcial → apelação');
r = run('Sentença', 'Julgo improcedentes os pedidos.', { orgao: 'Juizado Especial Cível de Morrinhos' });
check(princ(r).peca === 'Recurso inominado' && princ(r).dias === 10 && princ(r).base === 'Lei 9.099, art. 42' && it(r, 'Embargos').base === 'Lei 9.099, art. 49', 'Juizado: sentença → recurso inominado, 10 dias (Lei 9.099, art. 42)');
r = run('Sentença', 'Homologo o acordo celebrado entre as partes e extingo o processo com resolução do mérito.');
check(princ(r) === null || princ(r).kind === 'registro', 'sentença homologatória: sem apelação como principal') ;
check(it(r, 'Acompanhar trânsito').dias === null && it(r, 'Acompanhar trânsito').base === 'CPC 1.000', 'e orienta acompanhar o trânsito e o cumprimento (CPC 1.000)');
r = run('Decisão', 'Indefiro a tutela de urgência requerida pela parte autora, por ausência de perigo de dano.');
check(princ(r).peca === 'Agravo de instrumento' && princ(r).base === 'CPC 1.015, I' && princ(r).dias === 15, 'tutela indeferida (cliente autor) → agravo de instrumento (1.015, I)');
check(r.avisos.some(a => /Tema 988/.test(a)), 'avisa da taxatividade mitigada do art. 1.015');
r = run('Decisão', 'Defiro a tutela de urgência para determinar que o réu se abstenha de cobrar.', { dest: P });
check(princ(r).peca.includes('contra a tutela deferida'), 'tutela deferida contra o cliente (réu) → agravo de instrumento');
r = run('Decisão', 'Rejeito a preliminar e afasto a alegação de incompetência deste juízo.');
check(princ(r).peca === 'Agravo de instrumento' && princ(r).base === 'CPC 1.015, III', 'rejeição de incompetência → agravo (1.015, III)');
r = run('Decisão', 'Indefiro o pedido de gratuidade da justiça formulado pela parte autora.');
check(princ(r).base === 'CPC 1.015, V', 'gratuidade indeferida → agravo (1.015, V)');
r = run('Decisão', 'Excluo o litisconsorte Fulano do polo passivo, por ilegitimidade.');
check(princ(r).base === 'CPC 1.015, VII', 'exclusão de litisconsorte → agravo (1.015, VII)');
r = run('Decisão', 'Mantenho a distribuição dinâmica do ônus da prova nos termos da decisão anterior, indefiro a inversão.');
check(tem(r, 'Agravo de instrumento') && it(r, 'Agravo').base === 'CPC 1.015, XI c/c 373, §4º', 'ônus da prova → agravo (1.015, XI c/c 373, §4º)');
r = run('Decisão', 'Defiro o pedido de bloqueio de bens do réu como diligência, e determino a juntada dos documentos.');
check(princ(r) && princ(r).kind === 'registro' && princ(r).base === 'CPC 1.009, §1º', 'interlocutória genérica sem agravo → registro para preliminar de apelação (1.009, §1º), sem prazo');
r = run('Decisão', 'Indefiro a tutela de urgência.', { orgao: 'Juizado Especial Cível de Morrinhos' });
check(princ(r).kind === 'registro' && /não cabe agravo/.test(princ(r).peca), 'Juizado: não cabe agravo de instrumento → registro');

// --- incidentes e defesas
r = run('Despacho', 'Instaurado o incidente de desconsideração da personalidade jurídica, cite-se o sócio para manifestar-se e requerer as provas cabíveis em 15 dias (art. 135).');
check(tem(r, 'IDPJ') && it(r, 'IDPJ').base === 'CPC 135', 'IDPJ instaurado → manifestação/defesa com provas (CPC 135)');
r = run('Decisão', 'Acolho o pedido de desconsideração da personalidade jurídica e determino a inclusão dos sócios.');
check(princ(r).base === 'CPC 1.015, IV', 'IDPJ decidido → agravo (1.015, IV)');
r = run('Despacho', 'Intime-se a parte autora para se manifestar sobre a impugnação à justiça gratuita no prazo de 15 dias.');
check(tem(r, 'impugnação à gratuidade') && it(r, 'impugnação à gratuidade').base === 'CPC 100', 'impugnação à gratuidade → manifestação com provas (CPC 100)');
r = run('Despacho', 'Intime-se a parte para responder à arguição de suspeição do magistrado, em 15 dias.');
check(tem(r, 'suspeição') && it(r, 'suspeição').base === 'CPC 146, §1º', 'suspeição → resposta (CPC 146, §1º)');
r = run('Despacho', 'Cite-se o embargado para contestar os embargos de terceiro em 15 dias.', { dest: P });
check(tem(r, 'Contestação aos embargos de terceiro') && it(r, 'embargos de terceiro').base === 'CPC 683', 'embargos de terceiro → contestação');
r = run('Ato ordinatório', 'Intime-se a parte agravada para apresentar contraminuta ao agravo de instrumento.');
check(tem(r, 'Contraminuta') && it(r, 'Contraminuta').base === 'CPC 1.019, II', 'agravo de instrumento → contraminuta (1.019, II)');
r = run('Ato ordinatório', 'Intime-se o apelado para apresentar contrarrazões à apelação no prazo legal.');
check(princ(r).peca === 'Contrarrazões de apelação' && princ(r).dias === 15, 'apelação da outra parte → contrarrazões, 15 dias (1.010, §1º)');
r = run('Ato ordinatório', 'Intime-se o apelado para apresentar contrarrazões à apelação.', { orgao: 'Juizado Especial Cível' });
check(princ(r).peca.includes('Contrarrazões ao recurso inominado') && princ(r).dias === 10, 'Juizado: contrarrazões ao recurso inominado em 10 dias');
r = run('Despacho', 'Intime-se a parte contrária para manifestar-se sobre os embargos de declaração opostos, no prazo de 5 dias.');
check(tem(r, 'embargos de declaração') && it(r, 'embargos de declaração').dias === 5 && it(r, 'embargos de declaração').base === 'CPC 1.023, §2º', 'ED da outra parte → manifestação em 5 dias (1.023, §2º)');

// --- tribunal
r = run('Acórdão', 'Acordam os Desembargadores da 3ª Câmara Cível, por unanimidade, negar provimento ao recurso. Ementa: ...', { orgao: '3ª Câmara Cível', tribunal: 'TJGO' });
check(r.natureza === 'acordao' && r.instancia === 'tribunal' && princ(r) === null && tem(r, 'Embargos de declaração') && tem(r, 'Recurso especial / extraordinário'), 'acórdão → opções ED e REsp/RE (sem principal: depende do resultado)');
check(it(r, 'especial').dias === 15 && it(r, 'Embargos de declaração').dias === 5, 'com os prazos de 15 e 5 dias úteis');
r = run('Decisão', 'Nego provimento ao recurso, nos termos do art. 932, IV, do CPC.', { orgao: 'Gabinete do Desembargador Fulano', tribunal: 'TJGO' });
check(princ(r).peca === 'Agravo interno' && princ(r).base.startsWith('CPC 1.021'), 'decisão monocrática do relator → agravo interno (1.021)');
r = run('Despacho', 'Inclua-se o feito em pauta da sessão de julgamento virtual, podendo a parte requerer sustentação oral.', { orgao: '3ª Câmara Cível', tribunal: 'TJGO' });
check(tem(r, 'sustentação oral') && it(r, 'sustentação oral').dias === null, 'pauta/sustentação oral → registrar e conferir o regimento (sem prazo)');
r = run('Ato ordinatório', 'Certifico o retorno dos autos da instância superior. Intimem-se as partes para requerer o que entender de direito.');
check(tem(r, 'baixa e arquivamento') && it(r, 'baixa e arquivamento').dias === 15, 'retorno dos autos → cumprimento do acórdão ou baixa (15 dias)');

// --- secretaria e cumprimento
r = run('Ato ordinatório', 'Fica a parte intimada para vista dos autos pelo prazo de 5 dias.');
check(tem(r, 'pedido de vista') && it(r, 'pedido de vista').base === 'CPC 203, §4º', 'vista dos autos → petição de juntada, vista ou ciência (203, §4º)');
r = run('Ato ordinatório', 'Intime-se o advogado para regularizar a representação processual, juntando procuração, em 5 dias.');
check(tem(r, 'procuração') && it(r, 'procuração').dias === 5 && it(r, 'procuração').base === 'CPC 76', 'representação processual → procuração (CPC 76), 5 dias');
r = run('Certidão', 'Certifico o decurso do prazo sem manifestação da parte requerida.');
check(princ(r).peca.includes('prosseguimento') && princ(r).dias === 5 && tem(r, 'revelia') && tem(r, 'trânsito em julgado'), 'certidão de decurso → prosseguimento, revelia ou trânsito em julgado (5 dias)');
r = run('Despacho', 'Remetam-se os autos à contadoria judicial; apresentados os cálculos, intimem-se as partes para impugnação em 15 dias.');
check(tem(r, 'cálculos') && it(r, 'cálculos').base === 'CPC 524, §2º', 'cálculo da contadoria → impugnar ou concordar (524, §2º)');
r = run('Decisão', 'Intimado o executado para pagar o débito em 15 dias, sob pena de multa de 10% (art. 523).', { dest: P, classe: 'CUMPRIMENTO DE SENTENÇA' });
check(princ(r).peca === 'Pagamento voluntário' && tem(r, 'Impugnação ao cumprimento') && it(r, 'Impugnação ao cumprimento').base === 'CPC 525', 'cumprimento (executado) → pagamento (523) e impugnação (525)');
r = run('Decisão', 'Rejeito a impugnação ao cumprimento de sentença e determino o prosseguimento da execução.', { dest: P });
check(princ(r).peca.startsWith('Agravo de instrumento') && it(r, 'Apelação') && it(r, 'Apelação').base === 'CPC 1.009', 'impugnação rejeitada → agravo (se continua), ou apelação (se extinguiu)');
r = run('Decisão', 'Acolho a impugnação e extingo a execução, rejeitando o cumprimento de sentença.', { dest: A });
check(princ(r).peca.startsWith('Apelação'), 'impugnação acolhida com extinção → apelação como principal');
r = run('Ato ordinatório', 'Intimado o executado do bloqueio de valores via SISBAJUD, para manifestar-se no prazo legal.', { dest: P });
check(princ(r).peca.includes('bloqueio') && princ(r).dias === 5 && princ(r).base === 'CPC 854, §3º' && tem(r, 'Impugnação à penhora') && it(r, 'Impugnação à penhora').dias === 15, 'bloqueio SISBAJUD (executado) → 5 dias (854, §3º) e impugnação à penhora em 15 (525, §11)');
r = run('Ato ordinatório', 'Resultado do bloqueio via SISBAJUD positivo. Manifeste-se o exequente.', { dest: A });
check(princ(r).peca.includes('transferência'), 'bloqueio positivo (exequente) → requerer a transferência do valor');
r = run('Edital', 'Edital de leilão: o bem será levado a leilão, intimadas as partes. Prazo para manifestação sobre a avaliação.');
check(princ(r).peca.includes('valor da avaliação') && princ(r).dias === 10 && princ(r).base === 'CPC 903, §2º', 'leilão/avaliação → manifestação (903, §2º), 10 dias');
r = run('Ato ordinatório', 'Certifico que intimei a parte autora/exequente para realizar o recolhimento do sistema deferido, no prazo de quinze dias.', { diasTexto: { dias: 15, tipo: 'uteis' } });
check(princ(r).peca.includes('Cumprimento da determinação') && princ(r).dias === 15, 'recolher custas/diligência → cumprimento, prazo do texto');
r = run('Despacho', 'Manifeste-se a parte autora sobre a certidão do oficial de justiça, em 5 dias.', { diasTexto: { dias: 5, tipo: 'uteis' } });
check(princ(r).peca === 'Manifestação' && princ(r).dias === 5, 'despacho “manifeste-se” genérico → manifestação (prazo do texto)');
r = run('Decisão', 'DEFIRO o pedido de busca de informações pelo sistema PrevJUD. PROCEDA-SE à consulta.');
check(princ(r) && princ(r).kind === 'registro', 'decisão sem comando para a parte → só registro, sem inventar peça');
r = run('Despacho', 'Cumpra-se.');
check(r === null || r.itens.length === 0, 'despacho de mero expediente → nenhuma sugestão');

// --- prazo do texto x prazo da lei e dobro
r = run('Ato ordinatório', 'Intime-se a parte autora para, no prazo de 10 dias, impugnar a contestação.', { diasTexto: { dias: 10, tipo: 'uteis' } });
check(princ(r).dias === 10 && princ(r).origemPrazo === 'texto' && /a lei prevê 15/.test(princ(r).nota), 'manifestação: o prazo fixado no texto vale mais que o da lei (e avisa)');
r = run('Sentença', 'Julgo improcedentes os pedidos. Prazo de 5 dias para pagar as custas.', { diasTexto: { dias: 5, tipo: 'uteis' } });
check(princ(r).peca === 'Apelação' && princ(r).dias === 15, 'recurso: o prazo da lei não muda por causa de outro prazo citado no texto');
r = run('Sentença', 'Julgo improcedentes os pedidos.', { dest: [{ n: 'MUNICÍPIO DE MORRINHOS', p: 'P' }] });
check(r.dobro === 'fazenda', 'cliente é a Fazenda Pública (município): sugere prazo em dobro');
r = run('Sentença', 'Julgo improcedentes os pedidos.', { dest: [{ n: 'MUNICÍPIO DE MORRINHOS', p: 'P' }], orgao: 'Juizado Especial da Fazenda Pública' });
check(r.dobro === '', 'no Juizado não há prazo em dobro');
r = run('Sentença', 'Julgo improcedentes os pedidos.', { dest: [{ n: 'A', p: 'A' }, { n: 'B', p: 'P' }] });
check(r.polo === '' , 'quando a publicação não indica o lado do cliente, o lado fica em branco (a tela pede confirmação)');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
