import * as os from 'os';
import { NetworkAdapter } from '../../shared/types';
import { detectAdapterType, isAdapterActive } from './adapterUtils';

/**
 * Enumerates all network adapters on the system using os.networkInterfaces().
 * Returns a deduplicated list of NetworkAdapter objects.
 */
export function getNetworkAdapters(): NetworkAdapter[] {
  const interfaces = os.networkInterfaces();
  const adapters: NetworkAdapter[] = [];
  const seen = new Set<string>();

  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!addresses || addresses.length === 0) continue;

    // Deduplicate by interface name
    if (seen.has(name)) continue;
    seen.add(name);

    // Find MAC address (present on any address entry for this interface)
    const mac = addresses.find((a) => a.mac && a.mac !== '00:00:00:00:00:00')?.mac ?? '';

    // Find IPv4 and IPv6
    const ipv4Entry = addresses.find((a) => a.family === 'IPv4');
    const ipv6Entry = addresses.find((a) => a.family === 'IPv6' && !a.address.startsWith('fe80'));

    const active = isAdapterActive(addresses);
    const type = detectAdapterType(name);

    adapters.push({
      name,
      mac,
      type,
      status: active ? 'active' : 'inactive',
      ipv4: ipv4Entry?.address,
      ipv6: ipv6Entry?.address,
    });
  }

  // Sort: active first, then alphabetically
  return adapters.sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Returns only adapters that are currently active.
 */
export function getActiveAdapters(): NetworkAdapter[] {
  return getNetworkAdapters().filter((a) => a.status === 'active');
}

/**
 * Returns the primary active adapter (first active, preferring Ethernet over WiFi).
 */
export function getPrimaryAdapter(): NetworkAdapter | null {
  const active = getActiveAdapters();
  if (active.length === 0) return null;

  const ethernet = active.find((a) => a.type === 'ethernet');
  if (ethernet) return ethernet;

  const wifi = active.find((a) => a.type === 'wifi');
  if (wifi) return wifi;

  return active[0];
}
