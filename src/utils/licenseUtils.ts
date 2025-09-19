import { LicenseValidator } from '@/utils/licenseValidator';

/*
 * Convenience wrappers for demo / console testing
 * Real licence generation occurs server-side
 */
export class LicenseUtils {
  /* --- single validation call ----------------------------------- */
  public static async validateLicense(key: string) {
    try {
      return await LicenseValidator.validateLicenseKey(key);
    } catch (e) {
      console.error('Failed to validate license key:', e);
      throw e;
    }
  }

  /* --- quick console test --------------------------------------- */
  public static async testLicenseValidation() {
    const cpu = await LicenseValidator.getCpuCores();
    console.log('=== License Validation Test ===');
    console.log(`Detected cores: ${cpu.cores}`);

    /* two sample keys (replace with real ones) */
    const keys = [
      '003GG-A1VHT-5R44S-H2RXD-FM76W',
      '0FZGG-A52RK-T14BV-Q7R17-6EYJT'
    ];
    for (const k of keys) {
      console.log('\nTesting', k);
      const r = await LicenseValidator.validateLicenseKey(k);
      console.log('Result:', r);
    }

    /* invalid key */
    console.log('\nTesting invalid key');
    console.log(
      await LicenseValidator.validateLicenseKey(
        'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE'
      )
    );
    console.log('=== end ===');
  }

  /* formatting helpers */
  public static formatLicenseKey(k: string) {
    return k.replace(/[^A-Z0-9]/gi, '').replace(/(.{5})(?=.)/g, '$1-');
  }
  public static cleanLicenseKey(k: string) {
    return k.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  }
  public static isValidLicenseFormat(k: string) {
    const c = this.cleanLicenseKey(k);
    return c.length === 25 && /^[A-Z0-9]+$/.test(c);
  }
}

/* attach to window in dev */
if (typeof window !== 'undefined') {
  (window as any).LicenseUtils = LicenseUtils;
  (window as any).LicenseValidator = LicenseValidator;
}
