/* Repasses entre advogados (Fase 5, etapa 5.6): aviso no iPhone do proprietário quando ele passa a ter (ou deixa de ter) um repasse a receber.
   Os repasses (coleção `repasses`) nascem quando alguém marca um recebimento em que o dinheiro entrou na conta de um advogado e a divisão do honorário
   leva parte para outros; as regras de quem lê e muda estão em politica.js. */
import { proprietario } from './acesso.js';
import { normalizarUsuario } from './politica.js';

const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/* `antes` = registro atual (ou null se é novo); só avisa o que muda de situação, para não repetir o aviso a cada gravação */
export async function avisarRepasse(env, enviar, id, antes, depois) {
  try {
    if (!depois || !depois.para || (antes && antes.status === depois.status)) return;
    const dono = await proprietario(env); if (!dono) return;
    const ks = new Set(normalizarUsuario(dono).oabs); if (!ks.has(depois.para.oab)) return;   // só quando o repasse é a receber pelo proprietário
    const quem = String((depois.de && depois.de.nome) || 'Um advogado').split(' ')[0], onde = [depois.cliente, depois.label].filter(Boolean).join(' · ');
    const msg = { pendente: [quem + ' recebeu honorários', 'Seu repasse: ' + brl(depois.valor) + ' a receber. ' + onde], feito: [quem + ' diz que repassou ' + brl(depois.valor), onde + '. Confirme o recebimento no app.'], cancelado: ['Recebimento desfeito por ' + quem, onde + ' · ' + brl(depois.valor)] }[depois.status];
    if (msg && !(antes && depois.status === 'pendente')) await enviar(env, { tag: 'repasse-' + id + '-' + depois.status, titulo: msg[0], corpo: msg[1], url: '/' });
  } catch (e) { console.error('aviso de repasse', e); }
}
