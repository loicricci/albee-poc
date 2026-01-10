/**
 * Lightweight performance monitoring utilities
 * Only logs in development mode to avoid production overhead
 */

const marks: Record<string, number> = {};
const measures: Record<string, number[]> = {};

const isDev = process.env.NODE_ENV === 'development';

/**
 * Mark a point in time for later measurement
 */
export function perfMark(name: string): void {
  marks[name] = performance.now();
  if (isDev) {
    console.log(`[PERF] ⏱️ ${name}: ${marks[name].toFixed(0)}ms`);
  }
}

/**
 * Measure duration from a previous mark to now
 */
export function perfMeasure(name: string, startMark: string): number {
  const startTime = marks[startMark];
  if (!startTime) {
    if (isDev) {
      console.warn(`[PERF] Warning: No mark found for "${startMark}"`);
    }
    return 0;
  }
  
  const duration = performance.now() - startTime;
  
  // Store for averaging
  if (!measures[name]) {
    measures[name] = [];
  }
  measures[name].push(duration);
  
  if (isDev) {
    console.log(`[PERF] ✅ ${name}: ${duration.toFixed(0)}ms`);
  }
  
  return duration;
}

/**
 * Track an async operation's duration
 */
export async function perfTrack<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - start;
    
    if (isDev) {
      console.log(`[PERF] ✅ ${name}: ${duration.toFixed(0)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    if (isDev) {
      console.log(`[PERF] ❌ ${name} (failed): ${duration.toFixed(0)}ms`);
    }
    throw error;
  }
}

/**
 * Get average duration for a measure
 */
export function perfGetAverage(name: string): number {
  const durations = measures[name];
  if (!durations || durations.length === 0) return 0;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

/**
 * Report Web Vitals to console in development
 */
export function reportWebVitals(): void {
  if (typeof window === 'undefined') return;
  if (!isDev) return;
  
  if ('PerformanceObserver' in window) {
    try {
      // Observe paint timings
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log(`[VITALS] 🎨 ${entry.name}: ${entry.startTime.toFixed(0)}ms`);
        }
      }).observe({ entryTypes: ['paint'] });
      
      // Observe LCP
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log(`[VITALS] 📊 LCP: ${entry.startTime.toFixed(0)}ms`);
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });
      
      // Observe FID
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidEntry = entry as PerformanceEventTiming;
          console.log(`[VITALS] 👆 FID: ${fidEntry.processingStart - fidEntry.startTime}ms`);
        }
      }).observe({ entryTypes: ['first-input'] });
      
      // Observe CLS
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
            console.log(`[VITALS] 📐 CLS: ${clsValue.toFixed(3)}`);
          }
        }
      }).observe({ entryTypes: ['layout-shift'] });
      
    } catch (e) {
      // PerformanceObserver not fully supported
      console.warn('[VITALS] PerformanceObserver not fully supported');
    }
  }
  
  // Log navigation timing after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (timing) {
        console.log('[VITALS] 📈 Navigation Timing:');
        console.log(`  DNS: ${(timing.domainLookupEnd - timing.domainLookupStart).toFixed(0)}ms`);
        console.log(`  TCP: ${(timing.connectEnd - timing.connectStart).toFixed(0)}ms`);
        console.log(`  Request: ${(timing.responseStart - timing.requestStart).toFixed(0)}ms`);
        console.log(`  Response: ${(timing.responseEnd - timing.responseStart).toFixed(0)}ms`);
        console.log(`  DOM Interactive: ${timing.domInteractive.toFixed(0)}ms`);
        console.log(`  DOM Complete: ${timing.domComplete.toFixed(0)}ms`);
        console.log(`  Load Event: ${timing.loadEventEnd.toFixed(0)}ms`);
      }
    }, 0);
  });
}

/**
 * Log a performance summary
 */
export function perfSummary(): void {
  if (!isDev) return;
  
  console.log('[PERF] 📊 Performance Summary:');
  for (const [name, durations] of Object.entries(measures)) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    console.log(`  ${name}: avg=${avg.toFixed(0)}ms, min=${min.toFixed(0)}ms, max=${max.toFixed(0)}ms, count=${durations.length}`);
  }
}

// Type for PerformanceEventTiming (not in all TS versions)
interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
  processingEnd: number;
  cancelable: boolean;
}


