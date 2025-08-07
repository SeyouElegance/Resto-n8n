import { useState, useCallback, useEffect } from "react";
import { useBrowserFingerprint } from "./useBrowserFingerprint";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Fenêtre de temps en millisecondes
  storageKey: string;
}

interface RequestRecord {
  timestamp: number;
  count: number;
  fingerprint?: string;
}

// Fonction pour stocker dans plusieurs endroits
const setMultiStorage = (key: string, value: string) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
    // Aussi dans un cookie (limité mais plus difficile à supprimer pour un utilisateur lambda)
    document.cookie = `${key}=${value}; path=/; max-age=${24 * 60 * 60}`; // 24h
  } catch (e) {
    console.warn("Storage failed:", e);
  }
};

// Fonction pour récupérer depuis plusieurs endroits
const getMultiStorage = (key: string): string | null => {
  if (typeof window === "undefined") return null;

  // Essayer localStorage en premier
  let value = localStorage.getItem(key);
  if (value) return value;

  // Puis sessionStorage
  value = sessionStorage.getItem(key);
  if (value) {
    // Restaurer dans localStorage si trouvé dans sessionStorage
    localStorage.setItem(key, value);
    return value;
  }

  // Enfin, essayer les cookies
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, val] = cookie.trim().split("=");
    if (name === key && val) {
      // Restaurer dans les storages
      localStorage.setItem(key, val);
      sessionStorage.setItem(key, val);
      return val;
    }
  }

  return null;
};

export const useRateLimit = (config: RateLimitConfig) => {
  const [isLimited, setIsLimited] = useState(false);
  const [remainingRequests, setRemainingRequests] = useState(
    config.maxRequests
  );
  const [resetTime, setResetTime] = useState<Date | null>(null);
  const fingerprint = useBrowserFingerprint();

  // Initialiser le state au chargement de la page
  useEffect(() => {
    if (typeof window === "undefined" || !fingerprint) return;

    const stored = getMultiStorage(config.storageKey);
    if (!stored) return;

    try {
      const record: RequestRecord = JSON.parse(stored);
      const now = Date.now();
      const resetTimeValue = record.timestamp + config.windowMs;

      // Vérifier si on est encore dans la période de limitation
      if (now < resetTimeValue && record.count >= config.maxRequests) {
        setIsLimited(true);
        setRemainingRequests(0);
        setResetTime(new Date(resetTimeValue));
      } else if (now >= resetTimeValue) {
        // La période est expirée, reset
        localStorage.removeItem(config.storageKey);
        sessionStorage.removeItem(config.storageKey);
        setIsLimited(false);
        setRemainingRequests(config.maxRequests);
        setResetTime(null);
      } else {
        // Mise à jour du state avec les valeurs stockées
        setRemainingRequests(config.maxRequests - record.count);
        setIsLimited(false);
        setResetTime(null);
      }
    } catch (error) {
      console.warn("Erreur lors du parsing des données de rate limit:", error);
      // En cas d'erreur, on nettoie et repart de zéro
      localStorage.removeItem(config.storageKey);
      sessionStorage.removeItem(config.storageKey);
    }
  }, [fingerprint, config.storageKey, config.windowMs, config.maxRequests]); // Dépendances spécifiques

  const checkRateLimit = useCallback((): boolean => {
    if (typeof window === "undefined" || !fingerprint) return false;

    // Vérifier la manipulation seulement lors des appels explicites
    detectManipulation();

    const now = Date.now();
    const stored = getMultiStorage(config.storageKey);

    let record: RequestRecord = stored
      ? JSON.parse(stored)
      : { timestamp: now, count: 0, fingerprint };

    // Version BETA: Limitation persiste pendant 24h même après refresh
    const resetTime = record.timestamp + config.windowMs;

    // Si la période de 24h n'est pas encore écoulée ET la limite est atteinte
    if (now < resetTime && record.count >= config.maxRequests) {
      setIsLimited(true);
      setRemainingRequests(0);
      setResetTime(new Date(resetTime));
      return true;
    }

    // Si la période de 24h est écoulée, reset le compteur
    if (now >= resetTime) {
      record = { timestamp: now, count: 0, fingerprint };
      setMultiStorage(config.storageKey, JSON.stringify(record));
    }

    // Vérifier si on peut encore faire des requêtes
    if (record.count >= config.maxRequests) {
      setIsLimited(true);
      setRemainingRequests(0);
      setResetTime(new Date(resetTime));
      return true;
    }

    // Incrémenter le compteur et inclure le fingerprint
    record.count += 1;
    record.fingerprint = fingerprint;
    setMultiStorage(config.storageKey, JSON.stringify(record));

    setIsLimited(false);
    setRemainingRequests(config.maxRequests - record.count);
    setResetTime(
      record.count >= config.maxRequests ? new Date(resetTime) : null
    );

    return false;
  }, [config, fingerprint]);

  const getRemainingTime = useCallback((): number => {
    if (!resetTime) return 0;
    return Math.max(0, resetTime.getTime() - Date.now());
  }, [resetTime]);

  const reset = useCallback(() => {
    localStorage.removeItem(config.storageKey);
    sessionStorage.removeItem(config.storageKey);
    setIsLimited(false);
    setRemainingRequests(config.maxRequests);
    setResetTime(null);
  }, [config]);

  // Fonction pour détecter la manipulation des storages
  const detectManipulation = useCallback((): boolean => {
    if (typeof window === "undefined" || !fingerprint) return false;

    try {
      const localData = localStorage.getItem(config.storageKey);
      const sessionData = sessionStorage.getItem(config.storageKey);

      // Si l'un existe mais pas l'autre, c'est suspect
      if ((localData && !sessionData) || (!localData && sessionData)) {
        console.warn("🚨 Détection de manipulation des storages");
        // Restaurer la donnée manquante depuis l'autre storage
        if (localData) sessionStorage.setItem(config.storageKey, localData);
        if (sessionData) localStorage.setItem(config.storageKey, sessionData);
        return true;
      }

      // Vérifier l'intégrité du fingerprint si les données existent
      if (localData) {
        const record: RequestRecord = JSON.parse(localData);
        if (record.fingerprint && record.fingerprint !== fingerprint) {
          console.warn("🚨 Détection de changement de fingerprint suspect");
          return true;
        }
      }

      return false;
    } catch (e) {
      console.warn("Erreur lors de la détection de manipulation:", e);
      return false;
    }
  }, [config, fingerprint]);

  // Surveillance continue (désactivée pour éviter les boucles infinies)
  // Remplacée par une vérification uniquement lors des appels checkRateLimit

  return {
    checkRateLimit,
    isLimited,
    remainingRequests,
    resetTime,
    getRemainingTime,
    reset,
    detectManipulation,
  };
};
