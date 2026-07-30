/* eslint-disable */
"use client";

import html2canvas from "html2canvas";

/**
 * Captures a screenshot of a specific DOM element as a base64 string
 * @param elementId - The ID of the element to capture
 * @param options - Optional configuration for the screenshot
 * @returns Promise<string> - Base64 encoded PNG image
 */
export async function captureElementScreenshot(
  elementId: string,
  options?: {
    width?: number;
    height?: number;
    scale?: number;
    backgroundColor?: string;
  }
): Promise<string | null> {
  try {
    const element = document.getElementById(elementId);
    
    if (!element) {
      console.warn(`Element with ID "${elementId}" not found for screenshot`);
      return null;
    }

    // Use html2canvas to capture the element
    const canvas = await html2canvas(element, {
      scale: options?.scale ?? 2, // Higher quality
      backgroundColor: options?.backgroundColor ?? "#050508",
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: options?.width,
      height: options?.height,
    });

    // Convert canvas to base64 PNG
    const base64Image = canvas.toDataURL("image/png");
    return base64Image;
  } catch (error) {
    console.error("Failed to capture screenshot:", error);
    return null;
  }
}

/**
 * Captures a screenshot of the TV display for a specific match
 * This should be called when the match ends to capture the final state
 * @param matchId - The ID of the match to capture
 * @returns Promise<string | null> - Base64 encoded PNG image
 */
export async function captureTVDisplayScreenshot(matchId: string): Promise<string | null> {
  try {
    // The TV display should have an element with ID "tv-display-content"
    // We'll capture the entire display area
    return await captureElementScreenshot("tv-display-content", {
      scale: 2,
      backgroundColor: "#050508",
    });
  } catch (error) {
    console.error("Failed to capture TV display screenshot:", error);
    return null;
  }
}

/**
 * Downloads a base64 image as a file
 * @param base64Image - Base64 encoded image string
 * @param filename - Name for the downloaded file
 */
export function downloadBase64Image(base64Image: string, filename: string) {
  const link = document.createElement("a");
  link.href = base64Image;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Triggers a TV screenshot capture via Firebase
 * This sends a signal that the TV display should capture its state
 * @param matchId - The ID of the match
 */
export function requestTVScreenshotCapture(matchId: string) {
  // Store a request in localStorage that the TV display will check
  const request = {
    matchId,
    timestamp: Date.now(),
    captured: false,
  };
  
  localStorage.setItem("tv-screenshot-request", JSON.stringify(request));
  
  // Also dispatch a custom event for immediate response if TV is open
  window.dispatchEvent(
    new CustomEvent("request-tv-screenshot", { detail: { matchId } })
  );
}

/**
 * Checks if there's a pending screenshot request and returns it
 * Used by the TV display component
 */
export function getPendingScreenshotRequest(): { matchId: string; timestamp: number } | null {
  try {
    const stored = localStorage.getItem("tv-screenshot-request");
    if (!stored) return null;
    
    const request = JSON.parse(stored);
    if (request.captured) return null;
    
    // Clear requests older than 30 seconds
    if (Date.now() - request.timestamp > 30000) {
      localStorage.removeItem("tv-screenshot-request");
      return null;
    }
    
    return request;
  } catch (error) {
    return null;
  }
}

/**
 * Marks a screenshot request as captured
 */
export function markScreenshotCaptured() {
  const stored = localStorage.getItem("tv-screenshot-request");
  if (stored) {
    const request = JSON.parse(stored);
    request.captured = true;
    localStorage.setItem("tv-screenshot-request", JSON.stringify(request));
  }
}

/**
 * Stores a captured TV screenshot in localStorage for retrieval by report generation
 * @param matchId - The match ID
 * @param screenshot - Base64 encoded screenshot
 */
export function storeCapturedTVScreenshot(matchId: string, screenshot: string) {
  try {
    const screenshotData = {
      matchId,
      screenshot,
      capturedAt: Date.now(),
    };
    localStorage.setItem(`tv-screenshot-${matchId}`, JSON.stringify(screenshotData));
    markScreenshotCaptured();
  } catch (error) {
    console.error("Failed to store TV screenshot:", error);
  }
}

/**
 * Retrieves a captured TV screenshot from localStorage
 * @param matchId - The match ID
 * @returns string | null - Base64 encoded screenshot or null
 */
export function getCapturedTVScreenshot(matchId: string): string | null {
  try {
    const stored = localStorage.getItem(`tv-screenshot-${matchId}`);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    
    // Clear screenshots older than 1 hour
    if (Date.now() - data.capturedAt > 3600000) {
      localStorage.removeItem(`tv-screenshot-${matchId}`);
      return null;
    }
    
    return data.screenshot;
  } catch (error) {
    return null;
  }
}
