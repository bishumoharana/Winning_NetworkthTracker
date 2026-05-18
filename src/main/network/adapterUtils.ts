import * as os from 'os';
import { NetworkAdapter } from '../../shared/types';

/**
 * Infers the network adapter type from its name.
 * Uses common name patterns across Windows, macOS, and Linux.
 */
export function inferAdapterType(
  name: string
): NetworkAdapter['type'] {
  const n = name.toLowerCase();

  // WiFi patterns
  if (
    n.includes('wi-fi') ||
    n.includes('wifi') ||
    n.includes('wireless') ||
    n.includes('wlan') ||
    n.includes('802.11') ||
    n.includes('airport') ||
    /^wlp/.test(n) ||   // Linux: wlp2s0
    /^wlan/.test(n)     // Linux: wlan0
  ) {
    return 'wifi';
  }

  // Ethernet patterns
  if (
    n.includes('ethernet') ||
    n.includes('local area connection') ||
    n.includes('realtek') ||
    n.includes('intel(r) ethernet') ||
    /^eth/.test(n) ||   // Linux: eth0
    /^enp/.test(n) ||   // Linux: enp3s0
    /^eno/.test(n)      // Linux: eno1
  ) {
    return 'ethernet';
  }

  // Cellular patterns
  if (
    n.includes('cellular') ||
    n.includes('mobile') ||
    n.includes('lte') ||
    n.includes('3g') ||
    n.includes('4g') ||
    n.includes('5g') ||
    n.includes('wwan')
  ) {
    return 'cellular';
  }

  return 'unknown';
}

/**
 * Determines adapter status based on whether it has assigned IP addresses.
 * active  = has at least one non-internal IPv4 address
 * standby = has IPv6 only, or only link-local addresses
 * inactive = no addresses at all
 */
export function inferAdapterStatus(
  ifaces: os.NetworkInterfaceInfo[]
): NetworkAdapter['status'] {
  if (!ifaces || ifaces.length === 0) return 'inactive';

  const hasIPv4 = ifaces.some(
    (i) => i.family === 'IPv4' && !i.internal && i.address !== '0.0.0.0'
  );
  if (hasIPv4) return 'active';

  const hasIPv6 = ifaces.some(
    (i) => i.family === 'IPv6' && !i.internal
  );
  if (hasIPv6) return 'standby';

  return 'inactive';
}

/**
 * Normalises a raw MAC address to lowercase xx:xx:xx:xx:xx:xx format.
 * Handles both colon-separated and hyphen-separated formats.
 */
export function normalizeMac(mac: string): string {
  if (!mac || mac === '00:00:00:00:00:00') return mac;
  return mac
    .toLowerCase()
    .replace(/-/g, ':')
    .trim();
}

/**
 * Returns true for adapters that should be excluded from tracking:
 * loopback, virtual machines, VPN tunnels, Docker bridges, etc.
 */
export function isVirtualAdapter(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n === 'lo' ||
    n.startsWith('loopback') ||
    n.includes('vmware') ||
    n.includes('virtualbox') ||
    n.includes('vethernet') ||
    n.includes('docker') ||
    n.includes('hyper-v') ||
    n.includes('pseudo') ||
    n.includes('teredo') ||
    n.startsWith('tun') ||
    n.startsWith('tap') ||
    n.startsWith('veth') ||
    n.startsWith('br-') ||
    n.startsWith('virbr')
  );
}

/**
 * Returns a numeric sort priority for a given adapter type.
 * Lower number = higher priority (ethernet is most reliable).
 */
export function adapterTypePriority(type: NetworkAdapter['type']): number {
  switch (type) {
    case 'ethernet': return 1;
    case 'wifi':     return 2;
    case 'cellular': return 3;
    default:         return 4;
  }
}

/**
 * Sorts adapters by: active first, then by type priority (ethernet > wifi > cellular > unknown).
 */
export function prioritizeAdapters(adapters: NetworkAdapter[]): NetworkAdapter[] {
  return [...adapters].sort((a, b) => {
    const statusOrder: Record<NetworkAdapter['status'], number> = {
      active: 0,
      standby: 1,
      inactive: 2,
    };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return adapterTypePriority(a.type) - adapterTypePriority(b.type);
  });
}
