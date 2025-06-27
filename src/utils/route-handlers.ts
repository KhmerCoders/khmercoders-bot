// Route handlers utility

import { Context } from "hono";
import { getLandingFallbackTemplate, getDashboardFallbackTemplate } from "../templates";

/**
 * Handle landing page route
 */
export async function handleLandingPage(c: Context) {
  try {
    const url = new URL(c.req.url);
    url.pathname = "./landing.html";
    return c.env.ASSETS.fetch(url);
  } catch (error) {
    console.warn("Failed to serve landing.html from ASSETS, using fallback template");
    return c.html(getLandingFallbackTemplate());
  }
}

/**
 * Handle dashboard page route
 */
export async function handleDashboardPage(c: Context) {
  try {
    const url = new URL(c.req.url);
    url.pathname = "./index.html";
    return c.env.ASSETS.fetch(url);
  } catch (error) {
    console.warn("Failed to serve index.html from ASSETS, using fallback template");
    return c.html(getDashboardFallbackTemplate());
  }
}

/**
 * Handle static asset serving
 */
export async function handleStaticAsset(c: Context) {
  try {
    const url = new URL(c.req.url);
    return c.env.ASSETS.fetch(url);
  } catch (error) {
    console.error("Failed to serve static asset:", c.req.url);
    return c.text("Asset not found", 404);
  }
}

/**
 * Serve CSS files
 */
export async function serveCssAssets(c: Context) {
  return handleStaticAsset(c);
}

/**
 * Serve JavaScript files
 */
export async function serveJsAssets(c: Context) {
  return handleStaticAsset(c);
}

/**
 * Serve image files
 */
export async function serveImageAssets(c: Context) {
  return handleStaticAsset(c);
}
