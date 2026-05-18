import * as os from 'os';
import { NetworkAdapter } from '../../shared/types';
import {
  inferAdapterType,
  inferAdapterStatus,
  normalizeMac,
  isVirtualAdapter,
  prioritizeAdapters,
} from './adapterUtils';

/**
 * Enumerates all physical network adapters on the system.
 * Excludes loopback and virtual/VPN adapters.
 * Returns a sorted NetworkAdapter[] (active ethernet first).
 */
export function getAdapters(): NetworkAdapter[] {
  const raw = os.networkInterfaces();
  const adapters: NetworkAdapter[] = [];

  for (const [name, ifaces] of Object.entries(raw)) {
    if (!ifaces || ifaces.length === 0) continue;

    // Skip loopback and known virtual adapters
    if (isVirtualAdapter(name)) continue;

    // Skip all-internal adapters (loopback IPs only)
    const allInternal = ifaces.every((i) => i.internal);
    if (allInternal) continue;

    const mac = normalizeMac(ifaces[0].mac);
    const type = inferAdapterType(name);
    const status = inferAdapterStatus(ifaces);

    // Extract first IPv4 and IPv6 addresses
    const ipv4Entry = ifaces.find(
      (i) => i.family === 'IPv4' && !i.internal
    );
    const ipv6Entry = ifaces.find(
      (i) => i.family === 'IPv6' && !i.internal
    );

    adapters.push({
      name,
      mac,
      type,
      status,
      ipv4: ipv4Entry?.address,
      ipv6: ipv6Entry?.address,
    });
  }

  return prioritizeAdapters(adapters);
}

/**
 * Returns the primary (highest priority active) adapter, or null if none active.
 */
export function detectPrimaryAdapter(): NetworkAdapter | null {
  const adapters = getAdapters();
  return adapters.find((a) => a.status === 'active') ?? null;
}

/**
 * Logs all detected adapters to the console.
 * Used during development / Task 1.2 verification.
 */
export function logAdapters(): void {
  const adapters = getAdapters();
  // eslint-disable-next-line no-console
  console.warn(`[AdapterDetector] Found ${adapters.length} adapter(s):`);
  adapters.forEach((a, i) => {
    // eslint-disable-next-line no-console
    console.warn(
      `  [${i + 1}] ${a.name} | type=${a.type} | status=${a.status} | mac=${a.mac} | ipv4=${a.ipv4 ?? 'n/a'}`
    );
  });
}
