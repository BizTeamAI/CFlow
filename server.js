/*
 * CFlow License Server
 * • Stores only SHA-256 hashes of keys, never plaintext
 * • Adds +1 year for every new valid key submitted from the same machineId
 */

const express = require('express');
const cors = require('cors');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 7861;
const DATA_FILE = path.join(__dirname, 'license-activations.json');
const SECRET = 'mySecret';
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const MAP = Object.fromEntries(ALPHABET.split('').map((c, i) => [c, i]));

const app = express();
app.use(cors());
app.use(express.json());

/* ------------------------------------------------------------------ */
/* persistence                                                        */
/* ------------------------------------------------------------------ */
function load() {
  try {
    return fs.existsSync(DATA_FILE)
      ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
      : {};
  } catch {
    return {};
  }
}
function save(obj) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error('save error', e);
  }
}
let store = load();

/* ------------------------------------------------------------------ */
/* crypto check (same algorithm as client)                            */
/* ------------------------------------------------------------------ */
function base32Decode(str) {
  let bits = 0,
    v = 0,
    out = [];
  for (const ch of str) {
    const n = MAP[ch];
    if (n === undefined) throw 'char';
    v = (v << 5) | n;
    bits += 5;
    if (bits >= 8) {
      out.push((v >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  if (bits && (v & ((1 << bits) - 1))) throw 'pad';
  return Buffer.from(out);
}
function keyIsValid(key) {
  const raw = key.replace(/-/g, '').toUpperCase();
  if (raw.length !== 25) return false;
  const buf = base32Decode(raw.slice(0, 24));
  if (buf.length !== 15) return false;
  const sig = buf.subarray(10);
  if (ALPHABET[sig[4] >>> 3] !== raw[24]) return false;
  const expect = crypto
    .createHmac('sha256', SECRET)
    .update(buf.subarray(0, 10))
    .digest()
    .subarray(0, 5);
  return crypto.timingSafeEqual(sig, expect);
}

/* ------------------------------------------------------------------ */
/* routes                                                             */
/* ------------------------------------------------------------------ */
app.get('/health', (_, res) =>
  res.json({ status: 'ok', ts: new Date().toISOString() })
);

app.get('/api/v1/system/cpu-cores', (_, res) =>
  res.json({
    cores: os.cpus().length,
    cpuModel: os.cpus()[0]?.model,
    success: true,
    timestamp: new Date().toISOString()
  })
);

app.post('/api/v1/license/activation', (req, res) => {
  const { licenseKey } = req.body || {};

  if (!licenseKey)
    return res
      .status(400)
      .json({ success: false, message: 'licenseKey required' });

  if (!keyIsValid(licenseKey))
    return res.status(400).json({ success: false, message: 'invalid key' });

  /* hash key so plaintext is never stored */
  const hash = crypto
    .createHash('sha256')
    .update(licenseKey.replace(/-/g, '').toUpperCase())
    .digest('hex');

  const now = new Date().toISOString();
  
  // Server-wide activation (use fixed key for server)
  const SERVER_ID = 'cflow-server';
  let rec = store[SERVER_ID];

  if (!rec) {
    /* first key for this server */
    rec = { activationDate: now, years: 1, hashes: [hash] };
    store[SERVER_ID] = rec;
  } else if (!rec.hashes.includes(hash)) {
    /* new additional key => +1 year */
    rec.hashes.push(hash);
    rec.years += 1;
  }

  save(store);
  res.json({
    success: true,
    activationDate: rec.activationDate,
    years: rec.years
  });
});

app.get('/api/v1/license/status', (req, res) => {
  const SERVER_ID = 'cflow-server';
  const rec = store[SERVER_ID];
  if (!rec) return res.status(404).json({ success: false });
  res.json({
    success: true,
    activationDate: rec.activationDate,
    years: rec.years
  });
});

/* ------------------------------------------------------------------ */
app.listen(PORT, () => console.log(`CFlow license server on ${PORT}`));
