import { getRedisClient } from "./redis.js";

let accounts = null;
let rates = null;
let log = null;

const ACCOUNTS_KEY = "arvault:accounts";
const RATES_KEY = "arvault:rates";
const LOG_KEY = "arvault:log";

export async function init() {
  const client = await getRedisClient();
  
  accounts = await loadFromRedis(client, ACCOUNTS_KEY) || await getDefaultAccounts();
  rates = await loadFromRedis(client, RATES_KEY) || await getDefaultRates();
  log = await loadFromRedis(client, LOG_KEY) || [];

  await saveToRedis(client, ACCOUNTS_KEY, accounts);
  await saveToRedis(client, RATES_KEY, rates);
  await saveToRedis(client, LOG_KEY, log);
}

function getDefaultAccounts() {
  return [
    {
      "id": 1,
      "currency": "ARS",
      "balance": 120000000
    },
    {
      "id": 2,
      "currency": "USD",
      "balance": 60000
    },
    {
      "id": 3,
      "currency": "EUR",
      "balance": 40000
    },
    {
      "id": 4,
      "currency": "BRL",
      "balance": 60000
    }
  ];
}

function getDefaultRates() {
  return {
    "ARS": {
      "BRL": 0.00360,
      "EUR": 0.00057,
      "USD": 0.00068
    },
    "BRL": {
      "ARS": 277.3
    },
    "EUR": {
      "ARS": 1741
    },
    "USD": {
      "ARS": 1469
    }
  };
}

export function getAccounts() {
  return accounts;
}

export function getRates() {
  return rates;
}

export function getLog() {
  return log;
}

async function loadFromRedis(client, key) {
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`Error loading ${key} from Redis:`, err);
    return null;
  }
}

async function saveToRedis(client, key, data) {
  try {
    await client.set(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving ${key} to Redis:`, err);
  }
}

export async function updateAccounts(newAccounts) {
  accounts = newAccounts;
  const client = await getRedisClient();
  await saveToRedis(client, ACCOUNTS_KEY, accounts);
}

export async function updateRates(newRates) {
  rates = newRates;
  const client = await getRedisClient();
  await saveToRedis(client, RATES_KEY, rates);
}

export async function updateLog(newLog) {
  log = newLog;
  const client = await getRedisClient();
  await saveToRedis(client, LOG_KEY, log);
}

