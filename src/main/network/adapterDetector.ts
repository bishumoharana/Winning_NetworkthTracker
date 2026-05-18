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
 * Internal builder: converts os.networkInterfaces() into NetworkAdapter[].
 */
function buildAdapters(): NetworkAdapter[] {
  const raw = os.networkInterfaces();
  const adapters: NetworkAdapter[] = [];

  for (const [name, ifaces] of Object.entries(raw)) {
    if (!ifaces || ifaces.length === 0) continue;
    if (isVirtualAdapter(name)) continue;
    const allInternal = ifaces.every((i) => i.internal);
    if (allInternal) continue;

    const mac = normalizeMac(ifaces[0].mac);
    const type = inferAdapterType(name);
    const status = inferAdapterStatus(ifaces);

    const ipv4Entry = ifaces.find((i) => i.family === 'IPv4' && !i.internal);
    const ipv6Entry = ifaces.find((i) => i.family === 'IPv6' && !i.internal);

    adapters.push({ name, mac, type, status, ipv4: ipv4Entry?.address, ipv6: ipv6Entry?.address });
  }

  return prioritizeAdapters(adapters);
}

/** Returns all physical network adapters (active + standby + inactive), sorted by priority. */
export function getAdapters(): NetworkAdapter[] {
  return buildAdapters();
}

/** Alias used by networkMonitor.ts and networkHandlers.ts */
export function getNetworkAdapters(): NetworkAdapter[] {
  return buildAdapters();
}

/** Returns only adapters with status === 'active' */
export function getActiveAdapters(): NetworkAdapter[] {
  return buildAdapters().filter((a) => a.status === 'active');
}

/** Returns the highest-priority active adapter, or null. */
export function getPrimaryAdapter(): NetworkAdapter | null {
  return buildAdapters().find((a) => a.status === 'active') ?? null;
}

/** Alias used by adapterHandlers.ts */
export function detectPrimaryAdapter(): NetworkAdapter | null {
  return getPrimaryAdapter();
}

/** Logs all adapters to console on startup (development aid). */
export function logAdapters(): void {
  const adapters = buildAdapters();
  // eslint-disable-next-line no-console
  console.warn(`[AdapterDetector] Found ${adapters.length} adapter(s):`);
  adapters.forEach((a, i) => {
    // eslint-disable-next-line no-console
    console.warn(
      `  [${i + 1}] ${a.name} | type=${a.type} | status=${a.status} | mac=${a.mac} | ipv4=${a.ipv4 ?? 'n/a'}`
    );
  });
}
