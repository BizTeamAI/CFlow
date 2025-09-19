import "@xyflow/react/dist/style.css";
import { Suspense, useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { LoadingPage } from "./pages/LoadingPage";
import router from "./routes";
import { useDarkStore } from "./stores/darkStore";
import { useLicenseStore } from "./stores/licenseStore";

export default function App() {
  const dark = useDarkStore((state) => state.dark);
  const validateCurrentLicense = useLicenseStore((state) => state.validateCurrentLicense);
  const initializeCpuInfo = useLicenseStore((state) => state.initializeCpuInfo);
  const isInitialized = useLicenseStore((state) => state.isInitialized);
  
  useEffect(() => {
    if (!dark) {
      document.getElementById("body")!.classList.remove("dark");
    } else {
      document.getElementById("body")!.classList.add("dark");
    }
  }, [dark]);

  useEffect(() => {
    // Initialize CPU info and check server license status first
    const initializeApp = async () => {
      if (!isInitialized) {
        await initializeCpuInfo();
      }
      // Then validate any stored license key
      await validateCurrentLicense();
    };
    
    initializeApp();
  }, [initializeCpuInfo, validateCurrentLicense, isInitialized]);

  return (
    <Suspense fallback={<LoadingPage />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
