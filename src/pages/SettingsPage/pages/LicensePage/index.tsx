import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useLicenseStore } from "@/stores/licenseStore";
import { LicenseValidator } from "@/utils/licenseValidator";
import { cn } from "@/utils/utils";


export default function LicensePage() {
  const {
    licenseKey,
    licenseInfo,
    setLicenseKey,
    validateCurrentLicense,
    initializeCpuInfo,
    isInitialized
  } = useLicenseStore();

  const isProVersion = licenseInfo.isValid && licenseInfo.isPro && !licenseInfo.isExpired;

  const [inputKey, setInputKey] = useState(licenseKey ?? "");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  /* First-run initialisation */
  useEffect(() => {
    (async () => {
      if (!isInitialized) await initializeCpuInfo();
      await validateCurrentLicense();
    })();
  }, [isInitialized, initializeCpuInfo, validateCurrentLicense]);

  /* Helpers */
  const fmt = (k: string) => k.replace(/[^A-Z0-9]/gi, "").replace(/(.{5})(?=.)/g, "$1-");
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputKey(fmt(e.target.value.toUpperCase()));
    setLocalError(null);
  };

  /* Validate / Activate */
  const handleValidate = async () => {
    const clean = inputKey.replace(/[^A-Z0-9]/gi, "");
    if (clean.length !== 25) {
      setLocalError("Key must be 25 alphanumeric characters");
      return;
    }
    setBusy(true);
    const res = await LicenseValidator.validateLicenseKey(clean);
    setBusy(false);

    if (!res.isValid) {
      setLocalError(res.error ?? "Invalid license key");
      if (res.error?.includes("already active")) setInputKey("");
      return;
    }
    await setLicenseKey(clean);
    await validateCurrentLicense();
    setShowSuccess(true);
    setInputKey("");
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const cores = licenseInfo.actualCores;

  return (
    <div className="min-h-screen w-full bg-background overflow-auto">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">License Management</h1>
          <p className="text-muted-foreground">Manage your CFlow Pro licence</p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              License Status
              {isProVersion ? <Badge className="bg-green-600">PRO</Badge> : <Badge variant="secondary">Community</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <Label>Edition</Label>
                <p>{isProVersion ? "CFlow Pro" : "Community"}</p>
              </div>
              <div>
                <Label>Server CPU Cores</Label>
                <p className={cn(cores === 0 && "text-red-600")}>{cores || "Detection failed"}</p>
              </div>
              {licenseInfo.isValid && (
                <>
                  <div>
                    <Label>Licensed cores</Label>
                    <p>Up to {licenseInfo.maxCores}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <p className={cn(licenseInfo.isExpired ? "text-red-600" : "text-green-600")}>
                      {licenseInfo.isExpired ? "Expired" : "Active"}
                    </p>
                  </div>
                  <div>
                    <Label>Expires</Label>
                    <p>{licenseInfo.expirationDate?.toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label>Days left</Label>
                    <p className={cn(licenseInfo.daysRemaining && licenseInfo.daysRemaining < 30 && "text-orange-600")}>
                      {licenseInfo.daysRemaining ?? "--"}
                    </p>
                  </div>
                </>
              )}
            </div>

            {localError && (
              <Alert variant="destructive">
                <AlertDescription>{localError}</AlertDescription>
              </Alert>
            )}

            {licenseInfo.warning && (
              <Alert variant="default" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  <strong>Warning:</strong> {licenseInfo.warning}
                </AlertDescription>
              </Alert>
            )}

            {showSuccess && (
              <Alert className="border-green-600 bg-green-50 dark:bg-green-950">
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Licence {licenseKey ? "updated" : "activated"} successfully.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Input Card */}
        <Card>
          <CardHeader>
            <CardTitle>Activate or Extend License</CardTitle>
            <CardDescription>Enter a 25-character key</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label htmlFor="lic">License Key</Label>
            <div className="flex gap-3">
              <Input
                id="lic"
                value={inputKey}
                onChange={onInput}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                maxLength={29}
                className="font-mono text-lg flex-1"
              />
              <Button disabled={!inputKey.trim() || busy} onClick={handleValidate}>
                {busy ? "Validating…" : licenseKey ? "Extend" : "Activate"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
