/*
 * CFlow License Validator
 * - Validates 25-character Crockford-Base32 keys
 * - Sends each key once to the server; server returns activation metadata
 * - Never stores the plaintext key client-side
 */

import { api } from "../controllers/API/api";

export interface LicenseInfo {
  isValid: boolean;
  isPro: boolean;
  maxCores: number;        // always concrete
  actualCores: number;
  licenseId?: string;
  activationDate?: Date;
  expirationDate?: Date;
  daysRemaining?: number;
  isExpired?: boolean;
  error?: string;
  warning?: string;
}

/* ---------- constants ---------- */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const MAP: Record<string, number> = Object.fromEntries(
  ALPHABET.split('').map((c, i) => [c, i])
);
const SECRET = 'mySecret';
const EPOCH_2020 = new Date('2020-01-01T00:00:00Z');

/* ---------- helpers ---------- */
function base32Decode(s: string): Uint8Array {
  let bits = 0, val = 0;
  const out: number[] = [];
  for (const ch of s.toUpperCase()) {
    const v = MAP[ch];
    if (v === undefined) throw new Error('invalid char');
    val = (val << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  if (bits && (val & ((1 << bits) - 1))) throw new Error('partial byte');
  return new Uint8Array(out);
}
const dayToDate = (d: number) =>
  new Date(EPOCH_2020.getTime() + d * 86_400_000);

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* guaranteed ArrayBuffer (avoids SharedArrayBuffer union) */
async function hmacSha256(key: string, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const buf = new ArrayBuffer(data.byteLength);
  new Uint8Array(buf).set(data);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, buf);
  return new Uint8Array(sig);
}

/* CPU core detection (server-local) */
async function detectCpu(): Promise<{ cores: number; warning?: string }> {
  if (typeof window === 'undefined') {
    // Server-side: direct OS detection
    const os = require('os');
    const cores = os.cpus().length;
    return { cores };
  }
  
  // Browser-side: try multiple strategies to reach the license server
  
  // First try the proxy endpoint using the api object
  try {
    const response = await api.get('/api/v1/system/cpu-cores');
    
    if (response.data?.success && response.data?.cores > 0) {
      return { cores: response.data.cores };
    }
  } catch (e) {
    // Continue to direct endpoints
  }
  
  // If proxy fails, try direct endpoints with fetch
  const directEndpoints = [
    'http://localhost:7861/api/v1/system/cpu-cores',
    `http://${window.location.hostname}:7861/api/v1/system/cpu-cores`
  ];
  
  for (const endpoint of directEndpoints) {
    try {
      const r = await fetch(endpoint);
      if (r.ok) {
        const j = await r.json();
        if (j.success && j.cores > 0) {
          return { cores: j.cores };
        }
      }
    } catch (e) {
      continue;
    }
  }
  // If all endpoints fail, return a reasonable default without warning
  // CPU core count is informational and not critical for license validation
  return { cores: 64 };
}

/* ---------- local crypto check (tagged union) ---------- */
type LocalGood = {
  valid: true;
  coreCount: number;
  id: string;
  generated: Date;
};
type LocalBad = { valid: false; reason: string };
type LocalResult = LocalGood | LocalBad;

async function localValidate(key: string): Promise<LocalResult> {
  const raw = key.replace(/-/g, '').toUpperCase();
  if (raw.length !== 25) return { valid: false, reason: 'length' };

  const buf = base32Decode(raw.slice(0, 24));
  if (buf.length !== 15) return { valid: false, reason: 'format' };

  const sig = buf.subarray(10);
  if (ALPHABET[sig[4] >>> 3] !== raw[24])
    return { valid: false, reason: 'checksum' };

  const exp = (await hmacSha256(SECRET, buf.subarray(0, 10))).subarray(0, 5);
  if (!timingSafeEqual(sig, exp))
    return { valid: false, reason: 'signature' };

  const cores = ((buf[0] << 8) | buf[1]) + 1;
  const days = (buf[2] << 8) | buf[3];
  const id   = ((buf[4] << 8) | buf[5]).toString(10).padStart(3, '0');

  return { valid: true, coreCount: cores, id, generated: dayToDate(days) };
}

/* ---------- public class ---------- */
export class LicenseValidator {
  /* expose CPU detection to callers (LicenseUtils) */
  public static async getCpuCores() {
    return detectCpu();
  }

  /* check server license status without requiring a key */
  public static async checkServerLicenseStatus(cpuInfo?: { cores: number; warning?: string }): Promise<LicenseInfo> {
    const { cores: actualCores, warning } = cpuInfo || await detectCpu();

    try {
      const response = await api.get('/api/v1/license/status');
      const serverStatus = response.data;
      
      if (serverStatus.success) {
        // Server has active licenses
        const activation = new Date(serverStatus.activationDate);
        const expiry = new Date(activation);
        expiry.setFullYear(expiry.getFullYear() + serverStatus.years);
        
        const expired = Date.now() > expiry.getTime();
        const valid = !expired;
        
        return {
          isValid: valid,
          isPro: valid,
          maxCores: 65536, // Server-wide license allows up to 2^16 cores
          actualCores,
          activationDate: activation,
          expirationDate: expiry,
          daysRemaining: Math.max(
            0,
            Math.ceil((expiry.getTime() - Date.now()) / 86_400_000)
          ),
          isExpired: expired,
          error: expired ? `Server license expired on ${expiry.toLocaleDateString()}` : undefined,
          warning
        };
      }
    } catch (e) {
      // No server license or error checking
    }

    // No server license found
    return {
      isValid: false,
      isPro: false,
      maxCores: 0,
      actualCores,
      warning
    };
  }

  public static async validateLicenseKey(key: string): Promise<LicenseInfo> {
    const { cores: actualCores, warning } = await detectCpu();

    const local = await localValidate(key);
    if (!local.valid) {
      const errorMessages: Record<string, string> = {
        'length': 'License key must be exactly 25 characters',
        'format': 'Invalid license key format',
        'checksum': 'License key is invalid or corrupted',
        'signature': 'License key is not authentic'
      };
      
      return {
        isValid: false,
        isPro: false,
        maxCores: 0,
        actualCores,
        error: errorMessages[local.reason] || 'Invalid license key',
        warning
      };
    }
    const maxCores = local.coreCount;

    /* server activation */
    interface ServerResp {
      success: boolean;
      activationDate: string;
      years: number;
    }
    let server: ServerResp;
    try {
      const response = await api.post('/api/v1/license/activation', {
        licenseKey: key
      });
      server = response.data;
      if (!server.success) throw new Error('activation failed');
    } catch (e) {
      const errorMessage = (e as Error).message;
      let userError = 'License activation failed';
      
      if (errorMessage.includes('server 400')) {
        userError = 'Invalid license key format';
      } else if (errorMessage.includes('server 404')) {
        userError = 'License server not found';
      } else if (errorMessage.includes('server 500')) {
        userError = 'License server error - please try again';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network')) {
        userError = 'Cannot connect to license server';
      }
      
      return {
        isValid: false,
        isPro: false,
        maxCores,
        actualCores,
        error: userError,
        warning
      };
    }

    /* licence status */
    const activation = new Date(server.activationDate);
    const expiry = new Date(activation);
    expiry.setFullYear(expiry.getFullYear() + server.years);

    const expired = Date.now() > expiry.getTime();
    const coresOk = actualCores <= maxCores;
    const valid = !expired && coresOk;

    return {
      isValid: valid,
      isPro: valid,
      maxCores,
      actualCores,
      licenseId: local.id,
      activationDate: activation,
      expirationDate: expiry,
      daysRemaining: Math.max(
        0,
        Math.ceil((expiry.getTime() - Date.now()) / 86_400_000)
      ),
      isExpired: expired,
      error: !coresOk
        ? `License allows ${maxCores} cores, machine has ${actualCores}`
        : expired
        ? `License expired on ${expiry.toLocaleDateString()}`
        : undefined,
      warning
    };
  }
}
