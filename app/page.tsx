"use client";

import type React from "react";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface Restaurant {
  name: string;
  rating: number;
  reviews: number;
  distance: number;
  cuisine: string;
  address: string;
  comment?: string;
  aiSummary?: string;
  priceRange?: string;
  score?: number;
  hours?: string;
  expertComment?: string;
}

interface RestaurantStats {
  totalAnalyzed: number;
  totalValid: number;
  totalRecommended: number;
}

export default function RestaurantDiscovery() {
  const [radius, setRadius] = useState(300);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restaurantStats, setRestaurantStats] =
    useState<RestaurantStats | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const radiusRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only animate hero section if no results are present
    if (restaurants.length === 0) {
      // Hero animations
      const tl = gsap.timeline();

      tl.fromTo(
        titleRef.current,
        { y: 100, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, ease: "power3.out" }
      )
        .fromTo(
          subtitleRef.current,
          { y: 50, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power3.out" },
          "-=0.8"
        )
        .fromTo(
          radiusRef.current,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
          "-=0.6"
        )
        .fromTo(
          ctaRef.current,
          { y: 30, opacity: 0, scale: 0.9 },
          { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.7)" },
          "-=0.4"
        );
    } else {
      // If results are present, set all elements to their final state immediately
      gsap.set(
        [
          titleRef.current,
          subtitleRef.current,
          radiusRef.current,
          ctaRef.current,
        ],
        {
          y: 0,
          opacity: 1,
          scale: 1,
        }
      );
    }

    // Scroll animations for cards
    if (restaurants.length > 0) {
      gsap.fromTo(
        cardsRef.current?.children || [],
        { y: 100, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: cardsRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [restaurants]);

  // Auto-scroll to results when restaurants are found
  useEffect(() => {
    if (restaurants.length > 0 && resultsRef.current) {
      // Add a small delay to ensure the elements are rendered
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [restaurants]);

  const getUserLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          resolve(location);
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  const parseRestaurantData = (
    message: string
  ): { restaurants: Restaurant[]; stats: RestaurantStats | null } => {
    const lines = message.split("\n").filter(Boolean);
    const restaurants: Restaurant[] = [];
    let currentRestaurant: Partial<Restaurant> = {};
    let stats: RestaurantStats | null = null;
    let collectingComment = false;
    let commentLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("🍽️")) {
        // Skip title lines
        continue;
      } else if (line.startsWith("🤖")) {
        // Parse stats line: "🤖 _2 analysés • 2 validés • 2 recommandés_"
        const statsMatch = line.match(
          /(\d+)\s*analysés\s*•\s*(\d+)\s*validés\s*•\s*(\d+)\s*recommandés/
        );
        if (statsMatch) {
          stats = {
            totalAnalyzed: parseInt(statsMatch[1]),
            totalValid: parseInt(statsMatch[2]),
            totalRecommended: parseInt(statsMatch[3]),
          };
        }
        continue;
      } else if (/^🥇|🥈|🥉/.test(line)) {
        // Restaurant name (ex: "🥇 *Les Fables Gourmandes*")
        if (Object.keys(currentRestaurant).length > 0) {
          restaurants.push(currentRestaurant as Restaurant);
          currentRestaurant = {};
        }
        collectingComment = false;
        commentLines = [];
        currentRestaurant.name = line
          .replace(/🥇\s*\*?|🥈\s*\*?|🥉\s*\*?/g, "")
          .replace(/\*/g, "")
          .trim();
      } else if (line.startsWith("📍")) {
        // Address
        currentRestaurant.address = line.slice(2).trim();
      } else if (line.startsWith("⭐️")) {
        // Rating and reviews - Format: "⭐️ 4.6/5 • 349 avis • Score: 11.7"
        const ratingMatch = line.match(/(\d+\.?\d*)\s*\/\s*5/);
        const reviewsMatch = line.match(/•\s*(\d+)\s*avis/);
        const scoreMatch = line.match(/Score:\s*(\d+\.?\d*)/);

        if (ratingMatch) {
          currentRestaurant.rating = parseFloat(ratingMatch[1]);
        }
        if (reviewsMatch) {
          currentRestaurant.reviews = parseInt(reviewsMatch[1]);
        }
        if (scoreMatch) {
          currentRestaurant.score = parseFloat(scoreMatch[1]);
        }

        // Extract distance if present
        const distanceMatch = line.match(/(\d+)\s*m/);
        if (distanceMatch) {
          currentRestaurant.distance = parseInt(distanceMatch[1]);
        }
      } else if (line.startsWith("💰")) {
        // Price range - Format: "💰 €€ (Modéré) • 25-50€/pers" or "💰 Non spécifié"
        currentRestaurant.priceRange = line.slice(2).trim();
      } else if (line.startsWith("🕐")) {
        // Hours - Format: "🕐 Aujourd'hui: 12:00 – 14:00, 19:30 – 20:45 (Fermé)"
        currentRestaurant.hours = line.slice(2).trim();
      } else if (line.startsWith("🎯")) {
        // Expert comment - Format: "🎯 _\"Cuisine raffinée, service attentionné, produits frais, modéré\"_"
        const expertComment = line
          .slice(3) // Remove "🎯 " prefix
          .replace(/^_"/, "")
          .replace(/"_$/, "")
          .replace(/"/g, "")
          .trim();
        if (expertComment) {
          currentRestaurant.expertComment = expertComment;
        }
      } else if (line.startsWith("👨‍🍳")) {
        // AI Summary - Format: "👨‍🍳 _\"Excellence culinaire, service remarquable, expérience mémorable\"_"
        const aiSummary = line
          .slice(4) // Remove "👨‍🍳 " prefix
          .replace(/^_/, "")
          .replace(/_$/, "")
          .replace(/"/g, "")
          .trim();
        if (aiSummary) {
          currentRestaurant.aiSummary = aiSummary;
        }
      } else if (line.startsWith("💬")) {
        // Check if this is the start of the latest review section
        if (line.includes("*Dernier avis*")) {
          // Start collecting comment lines
          collectingComment = true;
          commentLines = [];
          continue;
        }
      } else if (collectingComment) {
        // We're collecting comment lines
        if (
          line.startsWith("━━━━━━━━━━━━━━━") ||
          /^🥇|🥈|🥉/.test(line) ||
          line.startsWith("🤖")
        ) {
          // End of comment section
          collectingComment = false;
          if (commentLines.length > 0) {
            let comment = commentLines
              .join(" ")
              .replace(/^_"/, "")
              .replace(/"_$/, "")
              .replace(/"/g, "")
              .replace(/\.\.\.$/, "")
              .replace(/^_/, "")
              .replace(/_$/, "")
              .trim();

            if (comment) {
              currentRestaurant.comment = comment;
            }
          }
          commentLines = [];

          // Process this line normally if it's not a separator
          if (/^🥇|🥈|🥉/.test(line)) {
            if (Object.keys(currentRestaurant).length > 0) {
              restaurants.push(currentRestaurant as Restaurant);
              currentRestaurant = {};
            }
            currentRestaurant.name = line
              .replace(/🥇\s*\*?|🥈\s*\*?|🥉\s*\*?/g, "")
              .replace(/\*/g, "")
              .trim();
          } else if (line.startsWith("━━━━━━━━━━━━━━━")) {
            if (Object.keys(currentRestaurant).length > 0) {
              restaurants.push(currentRestaurant as Restaurant);
              currentRestaurant = {};
            }
          }
        } else {
          // Add this line to the comment
          commentLines.push(line.trim());
        }
      } else if (line.startsWith("━━━━━━━━━━━━━━━")) {
        // End of restaurant
        if (Object.keys(currentRestaurant).length > 0) {
          restaurants.push(currentRestaurant as Restaurant);
          currentRestaurant = {};
        }
      }
    }

    // Handle any remaining comment collection at the end
    if (collectingComment && commentLines.length > 0) {
      let comment = commentLines
        .join(" ")
        .replace(/^_"/, "")
        .replace(/"_$/, "")
        .replace(/"/g, "")
        .replace(/\.\.\.$/, "")
        .replace(/^_/, "")
        .replace(/_$/, "")
        .trim();

      if (comment) {
        currentRestaurant.comment = comment;
      }
    }

    // Add the last restaurant if no final separator
    if (Object.keys(currentRestaurant).length > 0) {
      restaurants.push(currentRestaurant as Restaurant);
    }

    // Set default values for missing fields
    const processedRestaurants = restaurants.map((restaurant) => ({
      name: restaurant.name || "Restaurant",
      rating: restaurant.rating || 0,
      reviews: restaurant.reviews || 0,
      distance: restaurant.distance || 0,
      cuisine: restaurant.cuisine || "Non spécifié",
      address: restaurant.address || "Adresse non disponible",
      comment: restaurant.comment,
      aiSummary: restaurant.aiSummary,
      priceRange: restaurant.priceRange,
      score: restaurant.score,
      hours: restaurant.hours,
      expertComment: restaurant.expertComment,
    }));

    return { restaurants: processedRestaurants, stats };
  };

  const searchRestaurants = async () => {
    setLoading(true);
    setError(null);
    // Clear previous results before starting new search
    setRestaurants([]);
    setRestaurantStats(null);

    try {
      const location = userLocation || (await getUserLocation());
      const url = `http://localhost:5678/webhook/resto-reco?latitude=${location.lat}&longitude=${location.lng}&radius=${radius}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.message) {
        throw new Error("No message in response");
      }

      const { restaurants: parsedRestaurants, stats } = parseRestaurantData(
        data.message
      );
      setRestaurants(parsedRestaurants);
      setRestaurantStats(stats);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue lors de la recherche"
      );
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCTAClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Ripple effect
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    ripple.classList.add("ripple");

    button.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);

    // GSAP button animation
    gsap.to(button, {
      scale: 0.95,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: "power2.inOut",
    });

    searchRestaurants();
  };

  console.log(restaurants);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
      {/* Liquid Glass Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        {/* Layered gradients for depth */}
        <div className="absolute top-10 left-10 w-[32rem] h-[32rem] bg-gradient-to-br from-blue-300/30 via-white/10 to-purple-300/30 rounded-full blur-3xl shadow-2xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-[28rem] h-[28rem] bg-gradient-to-br from-purple-300/30 via-pink-200/20 to-blue-200/20 rounded-full blur-2xl shadow-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20rem] h-[20rem] bg-gradient-to-br from-cyan-200/30 to-blue-200/20 rounded-full blur-2xl shadow-lg animate-pulse delay-500"></div>
        {/* Soft light overlay */}
        <div className="absolute inset-0 bg-white/40 backdrop-blur-2xl mix-blend-lighten"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <nav className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🍽️ Restaurants autour de moi
          </div>
          <div className="text-sm text-gray-600 backdrop-blur-sm bg-white/20 px-4 py-2 rounded-full border border-white/30">
            ✨ Propulsé par IA - n8n
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section
        ref={heroRef}
        className={`relative z-10 min-h-[${
          restaurants.length > 0 ? "20vh" : "70vh"
        }] flex items-center justify-center px-6`}
      >
        <div className="text-center max-w-4xl mx-auto">
          <h1
            ref={titleRef}
            className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent leading-tight"
          >
            Trouve les meilleurs restos autour de toi
          </h1>

          <p
            ref={subtitleRef}
            className="text-xl md:text-2xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Clique ci-dessous pour détecter ta position et découvrir les
            meilleures adresses autour de toi.
          </p>

          {/* Radius Selector */}
          <div
            ref={radiusRef}
            className="backdrop-blur-md bg-white/20 rounded-2xl p-8 mb-8 border border-white/30 shadow-xl max-w-md mx-auto"
          >
            <label
              htmlFor="radius"
              className="block text-lg font-semibold text-gray-700 mb-4"
            >
              🎯 Rayon de recherche: {radius}m
            </label>
            <input
              type="range"
              id="radius"
              min="100"
              max="5000"
              step="50"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full h-3 bg-gradient-to-r from-blue-200 to-purple-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-sm text-gray-500 mt-2">
              <span>100m</span>
              <span>5000m</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Entre 100m et 5000m (par défaut: 300m)
            </p>
          </div>

          {/* CTA Button */}
          <button
            ref={ctaRef}
            onClick={handleCTAClick}
            disabled={loading}
            className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white px-12 py-4 rounded-2xl text-xl font-semibold shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <span className="relative z-10 flex items-center gap-3">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  📡 Recherche en cours...
                </>
              ) : (
                <>🔍 Lancer la recherche</>
              )}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
        </div>
      </section>

      {/* Error Section */}
      {error && (
        <section className="relative z-10 py-10 px-6">
          <div className="max-w-xl mx-auto">
            <div className="backdrop-blur-md bg-red-50/80 border border-red-200 rounded-2xl p-6 text-center">
              <div className="text-red-500 text-lg mb-2">
                ❌ Une erreur est survenue
              </div>
              {/* if no item is return, display a message */}
              {restaurants.length === 0 && (
                <p className="text-gray-600">
                  Aucun restaurant trouvé autour de vous.
                  <br /> Veuillez réessayer avec un rayon de recherche plus
                  large.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Results Section */}
      {restaurants.length > 0 && (
        <section ref={resultsRef} className="relative z-10 py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-5 bg-gradient-to-r from-gray-900 to-blue-800 bg-clip-text text-transparent">
              Tes meilleurs choix 🎯
              <br />
            </h2>
            {restaurantStats && (
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 backdrop-blur-md bg-blue-50/80 border border-blue-200 rounded-xl px-6 py-3 text-blue-800 font-semibold">
                  <span className="text-2xl">📊</span>
                  <span>
                    {restaurantStats.totalAnalyzed} analysés •{" "}
                    {restaurantStats.totalValid} validés •{" "}
                    {restaurantStats.totalRecommended} recommandés
                  </span>
                </div>
              </div>
            )}
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed text-center">
              Sélection des meilleures adresses autour de toi, selon une
              évaluation équilibrée entre qualité et nombre d'avis.
            </p>

            <div ref={cardsRef} className="grid md:grid-cols-3 gap-10">
              {restaurants.map((restaurant, index) => (
                <div
                  key={index}
                  tabIndex={0}
                  aria-label={`Carte du restaurant ${restaurant.name}`}
                  className="group h-full relative overflow-hidden backdrop-blur-2xl bg-white/30 border border-white/50 rounded-3xl p-8 shadow-2xl hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.25)] transition-all duration-500 flex flex-col focus:outline-none focus:ring-4 focus:ring-blue-300/40"
                >
                  {/* Animated glass border */}
                  <div className="absolute inset-0 rounded-3xl pointer-events-none border-2 border-transparent group-hover:border-blue-400/60 group-focus:border-blue-500/80 transition-all duration-500"></div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl font-extrabold text-blue-700 drop-shadow-sm">
                      #{index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-yellow-100/80 px-3 py-1 rounded-full shadow-sm">
                        <span className="text-yellow-600 text-xl">⭐️</span>
                        <span className="font-semibold text-yellow-700">
                          {restaurant.rating > 0
                            ? `${restaurant.rating}/5`
                            : "Pas de note"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-blue-700 mb-4 group-hover:text-blue-800 transition-colors">
                    {restaurant.name}
                  </h3>
                  <div className="flex-1 space-y-4 text-base">
                    <div className="flex items-start gap-2 text-gray-700">
                      <span className="text-lg">📍</span>
                      <span>{restaurant.address}</span>
                    </div>
                    {restaurant.expertComment && (
                      <div className="flex items-center gap-2 text-purple-700/90 bg-purple-100/40 px-3 py-2 rounded-xl text-sm">
                        <span
                          className="text-lg"
                          aria-label="Commentaire IA"
                          title="Commentaire IA"
                        >
                          🤖
                        </span>
                        <span>
                          Résumé de notre AI: <br /> {restaurant.expertComment}
                        </span>
                      </div>
                    )}
                    {restaurant.hours && (
                      <div className="flex items-center gap-2 text-blue-700/80 bg-blue-100/40 px-3 py-2 rounded-xl text-sm">
                        <span className="text-lg">🕐</span>
                        <span>{restaurant.hours}</span>
                      </div>
                    )}
                    {restaurant.priceRange && (
                      <div className="flex items-center gap-2 text-green-700/80 bg-green-100/40 px-3 py-2 rounded-xl text-sm">
                        <span className="text-lg">💰</span>
                        <span>{restaurant.priceRange}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-500 text-sm mt-2">
                      <span className="text-lg">🔥</span>
                      <span>{restaurant.cuisine}</span>
                      <span className="ml-auto text-blue-700 font-semibold">
                        {restaurant.reviews} avis
                      </span>
                    </div>
                    {restaurant.comment && (
                      <div className="mt-4 bg-white/60 rounded-xl p-4 text-gray-700 text-sm shadow-inner border border-white/30">
                        <span className="block mb-1 text-blue-700 font-semibold">
                          💬 Avis récent
                        </span>
                        <span>{restaurant.comment}</span>
                      </div>
                    )}
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      restaurant.name + " " + restaurant.address
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={0}
                    aria-label={`Voir ${restaurant.name} sur Google Maps`}
                    className="mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500/80 to-purple-500/80 text-white font-semibold shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
                  >
                    <span>Voir sur Google Maps</span>
                    <span className="text-lg">↗️</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="relative z-10 py-12 px-6 backdrop-blur-sm bg-white/10 border-t border-white/20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600 mb-4">
            Made with ❤️ for food lovers • Powered by AI recommendations
          </p>
          <div className="flex justify-center gap-6 text-sm text-gray-500">
            <span>🍽️ Restaurants</span>
            <span>📱 Mobile-first</span>
            <span>🤖 IA-powered</span>
            <span>⚡ Ultra-fast</span>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: linear-gradient(45deg, #3b82f6, #8b5cf6);
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: linear-gradient(45deg, #3b82f6, #8b5cf6);
          cursor: pointer;
          border: none;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .ripple {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.6);
          transform: scale(0);
          animation: ripple-animation 0.6s linear;
          pointer-events: none;
        }

        @keyframes ripple-animation {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
