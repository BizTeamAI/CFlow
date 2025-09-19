import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LicenseValidator, type LicenseInfo } from "@/utils/licenseValidator";

/* ------------------------------------------------------------------
   Store shape
------------------------------------------------------------------ */
interface LicenseState {
  /* persisted */
  licenseKey: string | null;

  /* runtime */
  licenseInfo: LicenseInfo;
  isInitialized: boolean;

  /* actions */
  initializeCpuInfo: () => Promise<void>;
  setLicenseKey: (key: string) => Promise<void>;
  clearLicense: () => void;
  validateCurrentLicense: () => Promise<void>;
  isProVersion: () => boolean;
}

const defaultInfo: LicenseInfo = {
  isValid: false,
  isPro: false,
  maxCores: 0,
  actualCores: 0,
  activationDate: undefined,
  expirationDate: undefined,
  daysRemaining: 0,
  isExpired: false,
  warning: undefined
};

/* ------------------------------------------------------------------
   Zustand store (persists only the licence key)
------------------------------------------------------------------ */
export const useLicenseStore = create<LicenseState>()(
  persist(
    (set, get) => ({
      /* ---------- state ---------- */
      licenseKey: null,
      licenseInfo: defaultInfo,
      isInitialized: false,

      /* ---------- actions ---------- */
      initializeCpuInfo: async () => {
        // Get CPU info once and pass it to server status check to avoid duplicate requests
        const cpu = await LicenseValidator.getCpuCores();
        
        // Check if server already has valid licenses (pass CPU info to avoid duplicate detection)
        const serverStatus = await LicenseValidator.checkServerLicenseStatus(cpu);
        
        set({
          licenseInfo: {
            ...serverStatus,
            actualCores: cpu.cores,
            warning: cpu.warning || serverStatus.warning || undefined
          },
          isInitialized: true
        });
      },

      setLicenseKey: async (rawKey: string) => {
        const clean = rawKey.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        if (clean.length !== 25) {
          set({
            licenseInfo: {
              ...get().licenseInfo,
              isValid: false,
              error: "Key must be 25 alphanumeric characters"
            }
          });
          return;
        }

        if (get().licenseKey === clean) {
          set({
            licenseInfo: {
              ...get().licenseInfo,
              isValid: false,
              error: "This license key is already active. Enter a different key to extend."
            }
          });
          return;
        }

        const info = await LicenseValidator.validateLicenseKey(clean);
        set({ licenseKey: info.isValid ? clean : null, licenseInfo: info });
      },

      clearLicense: () => {
        set({
          licenseKey: null,
          licenseInfo: { ...defaultInfo, actualCores: get().licenseInfo.actualCores }
        });
      },

      validateCurrentLicense: async () => {
        const key = get().licenseKey;
        if (!key) {
          // No stored license key, but don't reset if we already have server license info
          const currentInfo = get().licenseInfo;
          if (!currentInfo.isValid) {
            // Only reset if we don't already have valid server license
            set({ 
              licenseInfo: { 
                ...defaultInfo, 
                actualCores: currentInfo.actualCores,
                warning: currentInfo.warning
              } 
            });
          }
          return;
        }
        const info = await LicenseValidator.validateLicenseKey(key);
        set({ licenseInfo: info });
      },

      isProVersion: () => {
        const i = get().licenseInfo;
        return i.isValid && i.isPro && !i.isExpired;
      }
    }),
    {
      name: "license-storage",
      partialize: s => ({ licenseKey: s.licenseKey })
    }
  )
);

export const initialiseCpuInfo = () => useLicenseStore.getState().initializeCpuInfo();