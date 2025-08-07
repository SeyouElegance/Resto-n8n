import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

// Stockage en mémoire pour le rate limiting (en production, utilisez Redis ou une DB)
const requestCounts = new Map<string, { count: number; timestamp: number }>();

const RATE_LIMIT = {
  maxRequests: 2,
  windowMs: 24 * 60 * 60 * 1000, // 24 heures pour la version BETA
};

function getClientIdentifier(request: NextRequest): string {
  // Obtenir l'IP
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const clientIP = request.headers.get("x-client-ip");

  let ip = "unknown";
  if (forwarded) {
    ip = forwarded.split(",")[0].trim();
  } else if (realIP) {
    ip = realIP;
  } else if (clientIP) {
    ip = clientIP;
  } else {
    // Fallback pour le développement local - NextRequest n'a pas de propriété ip
    ip = "127.0.0.1";
  }

  // Obtenir le User-Agent et en créer un hash simple
  const userAgent = request.headers.get("user-agent") || "unknown";
  const userAgentHash = Buffer.from(userAgent.slice(0, 100))
    .toString("base64")
    .slice(0, 16);

  // Combiner IP + User-Agent hash pour créer un identifiant unique
  return `${ip}_${userAgentHash}`;
}

function isRateLimited(clientId: string): {
  limited: boolean;
  remainingRequests: number;
  resetTime?: number;
} {
  const now = Date.now();
  const record = requestCounts.get(clientId);

  if (!record || now - record.timestamp > RATE_LIMIT.windowMs) {
    // Nouvelle fenêtre de temps ou premier appel
    requestCounts.set(clientId, { count: 1, timestamp: now });
    return { limited: false, remainingRequests: RATE_LIMIT.maxRequests - 1 };
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    // Limite atteinte
    const resetTime = record.timestamp + RATE_LIMIT.windowMs;
    return { limited: true, remainingRequests: 0, resetTime };
  }

  // Incrémenter le compteur
  record.count += 1;
  requestCounts.set(clientId, record);

  return {
    limited: false,
    remainingRequests: RATE_LIMIT.maxRequests - record.count,
  };
}

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const { limited, remainingRequests, resetTime } = isRateLimited(clientId);

    if (limited) {
      const retryAfter = resetTime
        ? Math.ceil((resetTime - Date.now()) / 1000)
        : 60;

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Version BETA: Limite de ${RATE_LIMIT.maxRequests} requêtes par 24h atteinte. Réessayez demain ou rafraîchissez votre navigateur.`,
          retryAfter,
          clientId: clientId, // Pour debug (retirez en production)
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": RATE_LIMIT.maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": resetTime?.toString() || "",
          },
        }
      );
    }

    // Extraire les paramètres de requête
    const { searchParams } = new URL(request.url);
    const latitude = searchParams.get("latitude");
    const longitude = searchParams.get("longitude");
    const radius = searchParams.get("radius");

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Missing required parameters: latitude and longitude" },
        { status: 400 }
      );
    }

    // Appel vers l'API n8n
    const n8nUrl = `https://semmyhkm.app.n8n.cloud/webhook/resto-reco?latitude=${latitude}&longitude=${longitude}&radius=${
      radius || "300"
    }`;

    const response = await fetch(n8nUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Restaurant-Discovery-App/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`N8N API error: ${response.status}`);
    }

    const data = await response.json();

    // Retourner les données avec les headers de rate limiting
    return NextResponse.json(data, {
      headers: {
        "X-RateLimit-Limit": RATE_LIMIT.maxRequests.toString(),
        "X-RateLimit-Remaining": remainingRequests.toString(),
        "X-Client-ID": clientId, // Pour debug (retirez en production)
      },
    });
  } catch (error) {
    console.error("API Error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Une erreur est survenue lors de la récupération des données",
      },
      { status: 500 }
    );
  }
}

// Nettoyage périodique des anciens enregistrements (optionnel)
setInterval(() => {
  const now = Date.now();
  for (const [clientId, record] of requestCounts.entries()) {
    if (now - record.timestamp > RATE_LIMIT.windowMs * 2) {
      requestCounts.delete(clientId);
    }
  }
}, RATE_LIMIT.windowMs);
