import { useState, useEffect } from "react";

interface BrowserFingerprint {
  screen: string;
  timezone: string;
  language: string;
  platform: string;
  userAgent: string;
  cookieEnabled: boolean;
  doNotTrack: string;
}

export const useBrowserFingerprint = () => {
  const [fingerprint, setFingerprint] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Vérifier si on a déjà un fingerprint en cache
    const cachedFingerprint = sessionStorage.getItem("browser-fingerprint");
    if (cachedFingerprint) {
      setFingerprint(cachedFingerprint);
      return;
    }

    const generateFingerprint = (): string => {
      const data: BrowserFingerprint = {
        screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        userAgent: navigator.userAgent.slice(0, 100), // Tronqué pour éviter les variations
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack || "unknown",
      };

      // Créer un hash simple de ces données
      const fingerprint = btoa(JSON.stringify(data))
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 32);

      return fingerprint;
    };

    const newFingerprint = generateFingerprint();
    setFingerprint(newFingerprint);

    // Mettre en cache pour éviter les recalculs
    sessionStorage.setItem("browser-fingerprint", newFingerprint);
  }, []); // Pas de dépendances pour éviter les recalculs

  return fingerprint;
};
