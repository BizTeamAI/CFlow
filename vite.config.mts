import react from "@vitejs/plugin-react-swc";
import * as dotenv from "dotenv";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";
import {
  API_ROUTES,
  BASENAME,
  PORT,
  PROXY_TARGET,
} from "./src/customization/config-constants";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const envCFlowResult = dotenv.config({
    path: path.resolve(__dirname, "../../.env"),
  });

  const envCFlow = envCFlowResult.parsed || {};

  const apiRoutes = API_ROUTES || ["^/api/v1/", "^/api/v2/", "/health"];

  const target =
    env.VITE_PROXY_TARGET || PROXY_TARGET || "http://localhost:7860";

  const port = Number(env.VITE_PORT) || PORT || 3000;

  // Start with specific license server endpoints (must come first!)
  const proxyTargets: Record<string, any> = {};
  
  // License server specific endpoints
  proxyTargets['^/api/v1/system/cpu-cores'] = {
    target: "http://localhost:7861",
    changeOrigin: true,
    secure: false,
    ws: true,
  };

  proxyTargets['^/api/v1/license/'] = {
    target: "http://localhost:7861",
    changeOrigin: true,
    secure: false,
    ws: true,
  };

  // General API routes (comes after specific ones)
  apiRoutes.forEach(route => {
    proxyTargets[route] = {
      target: target,
      changeOrigin: true,
      secure: false,
      ws: true,
    };
  });

  return {
    base: BASENAME || "",
    build: {
      outDir: "build",
    },
    define: {
      "process.env.BACKEND_URL": JSON.stringify(
        envCFlow.BACKEND_URL ?? "http://localhost:7860",
      ),
      "process.env.ACCESS_TOKEN_EXPIRE_SECONDS": JSON.stringify(
        envCFlow.ACCESS_TOKEN_EXPIRE_SECONDS ?? 60,
      ),
      "process.env.CI": JSON.stringify(envCFlow.CI ?? false),
      "process.env.CFLOW_AUTO_LOGIN": JSON.stringify(
        envCFlow.CFLOW_AUTO_LOGIN ?? true,
      ),
      "process.env.CFLOW_FEATURE_MCP_COMPOSER": JSON.stringify(
        envCFlow.CFLOW_FEATURE_MCP_COMPOSER ?? "true",
      ),
    },
    plugins: [react(), svgr(), tsconfigPaths()],
    server: {
      port: port,
      proxy: {
        ...proxyTargets,
      },
    },
  };
});
