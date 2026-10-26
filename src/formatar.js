// Formatação brasileira com Intl.
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
const dataHoraBr = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

const formatarNumero = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : numero.format(n));
const formatarMoeda = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : moeda.format(n));
const formatarData = (d) => (d ? dataBr.format(new Date(d)) : '—');
const formatarDataHora = (d) => (d ? dataHoraBr.format(new Date(d)) : '—');
// Valor para <input type="date">
const dataParaInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

module.exports = { formatarNumero, formatarMoeda, formatarData, formatarDataHora, dataParaInput };
