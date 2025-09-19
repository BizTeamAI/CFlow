import { useEffect, useRef, useState } from "react";
import CFlowLogo from "@/assets/CFlowLogo.svg?react";
import { Button } from "@/components/ui/button";
import CustomAccountMenu from "@/customization/components/custom-AccountMenu";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import useTheme from "@/customization/hooks/use-custom-theme";
import { useLicenseStore } from "@/stores/licenseStore";
import FlowMenu from "./components/FlowMenu";

export default function AppHeader(): JSX.Element {
  const navigate = useCustomNavigate();
  const [activeState, setActiveState] = useState<"notifications" | null>(null);
  const notificationRef = useRef<HTMLButtonElement | null>(null);
  const notificationContentRef = useRef<HTMLDivElement | null>(null);
  const licenseInfo = useLicenseStore((state) => state.licenseInfo);
  const isProVersion = licenseInfo.isValid && licenseInfo.isPro && !licenseInfo.isExpired;
  
  useTheme();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isNotificationButton = notificationRef.current?.contains(target);
      const isNotificationContent =
        notificationContentRef.current?.contains(target);

      if (!isNotificationButton && !isNotificationContent) {
        setActiveState(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div
      className={`z-10 flex h-[48px] w-full items-center justify-between border-b px-6 dark:bg-background`}
      data-testid="app-header"
    >
      {/* Left Section */}
      <div
        className={`z-30 flex shrink-0 items-center gap-2`}
        data-testid="header_left_section_wrapper"
      >
        <Button
          unstyled
          onClick={() => navigate("/")}
          className="mr-1 flex h-8 w-8 items-center"
          data-testid="icon-ChevronLeft"
        >
          <CFlowLogo className="h-6 w-6" />
        </Button>
        {/* PRO Badge */}
        {isProVersion && (
          <div className="ml-1 flex items-center">
            <span className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              PRO
            </span>
          </div>
        )}
      </div>

      {/* Middle Section */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <FlowMenu />
      </div>

      {/* Right Section */}
      <div
        className={`relative left-3 z-30 flex shrink-0 items-center gap-3`}
        data-testid="header_right_section_wrapper"
      >
        <div className="flex">
          <CustomAccountMenu />
        </div>
      </div>
    </div>
  );
}
