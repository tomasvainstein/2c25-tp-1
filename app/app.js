import express from "express";
import rateLimit from "express-rate-limit";
import StatsD from 'node-statsd';

import {
  init as exchangeInit,
  getAccounts,
  setAccountBalance,
  getRates,
  setRate,
  getLog,
  exchange,
} from "./exchange.js";

// StatsD para métricas de rate limiting
const statsd = new StatsD({
  host: 'graphite',
  port: 8125,
  prefix: 'arVault.rateLimit.'
});

await exchangeInit();

const app = express();
const port = 3000;

app.use(express.json());

// Rate limiting global - protección básica
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requests por IP por ventana
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true, // incluir RateLimit headers en response
  legacyHeaders: false, // deshabilitar X-RateLimit-* headers
  handler: (req, res) => {
    statsd.increment('global.blocked');
    res.status(429).json({
      error: "Too many requests from this IP, please try again later.",
      retryAfter: "15 minutes"
    });
  }
});

// Rate limiting estricto para operaciones críticas
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // máximo 10 requests por IP por minuto
  message: {
    error: "Too many critical operations from this IP, please try again later.",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    statsd.increment('strict.blocked');
    res.status(429).json({
      error: "Too many critical operations from this IP, please try again later.",
      retryAfter: "1 minute"
    });
  }
});

// Rate limiting para consultas
const queryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // máximo 60 requests por IP por minuto
  message: {
    error: "Too many queries from this IP, please try again later.",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    statsd.increment('query.blocked');
    res.status(429).json({
      error: "Too many queries from this IP, please try again later.",
      retryAfter: "1 minute"
    });
  }
});

// Aplicar rate limiting global
app.use(globalLimiter);

// Middleware para métricas de requests exitosos
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode < 400) {
      statsd.increment('requests.success');
    } else if (res.statusCode >= 400 && res.statusCode < 500) {
      statsd.increment('requests.client_error');
    } else if (res.statusCode >= 500) {
      statsd.increment('requests.server_error');
    }
    originalSend.call(this, data);
  };
  next();
});

// ACCOUNT endpoints

app.get("/accounts", queryLimiter, (req, res) => {
  statsd.increment('endpoints.accounts.get');
  res.json(getAccounts());
});

app.put("/accounts/:id/balance", strictLimiter, (req, res) => {
  const accountId = req.params.id;
  const { balance } = req.body;

  if (!accountId || !balance) {
    return res.status(400).json({ error: "Malformed request" });
  } else {
    setAccountBalance(accountId, balance);
    statsd.increment('endpoints.accounts.put');
    res.json(getAccounts());
  }
});

// RATE endpoints

app.get("/rates", queryLimiter, (req, res) => {
  statsd.increment('endpoints.rates.get');
  res.json(getRates());
});

app.put("/rates", strictLimiter, (req, res) => {
  const { baseCurrency, counterCurrency, rate } = req.body;

  if (!baseCurrency || !counterCurrency || !rate) {
    return res.status(400).json({ error: "Malformed request" });
  }

  const newRateRequest = { ...req.body };
  setRate(newRateRequest);
  statsd.increment('endpoints.rates.put');
  res.json(getRates());
});

// LOG endpoint

app.get("/log", queryLimiter, (req, res) => {
  statsd.increment('endpoints.log.get');
  res.json(getLog());
});

// EXCHANGE endpoint - operación más crítica, límite más estricto

app.post("/exchange", strictLimiter, async (req, res) => {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId,
    counterAccountId,
    baseAmount,
  } = req.body;

  if (
    !baseCurrency ||
    !counterCurrency ||
    !baseAccountId ||
    !counterAccountId ||
    !baseAmount
  ) {
    return res.status(400).json({ error: "Malformed request" });
  }

  const exchangeRequest = { ...req.body };
  const exchangeResult = await exchange(exchangeRequest);
  statsd.increment('endpoints.exchange.post');

  if (exchangeResult.ok) {
    res.status(200).json(exchangeResult);
  } else {
    res.status(500).json(exchangeResult);
  }
});

app.listen(port, () => {
  console.log(`Exchange API listening on port ${port}`);
});

export default app;
