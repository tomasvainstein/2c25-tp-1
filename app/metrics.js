import StatsD from 'hot-shots';

const host = process.env.STATSD_HOST || 'localhost';
const port = Number(process.env.STATSD_PORT || 8125);
const prefix = process.env.STATSD_PREFIX || 'arvault.';

export const statsd = new StatsD({ host, port, prefix, errorHandler: () => {} });

export function recordBuy(currency, amount) {
  if (!currency || typeof amount !== 'number') return;
  statsd.increment(`volume.${currency}.buy`, amount);
  statsd.gauge(`net.${currency}`, amount, 1);
}

export function recordSell(currency, amount) {
  if (!currency || typeof amount !== 'number') return;
  statsd.increment(`volume.${currency}.sell`, amount);
  statsd.gauge(`net.${currency}`, -amount, 1);
}


