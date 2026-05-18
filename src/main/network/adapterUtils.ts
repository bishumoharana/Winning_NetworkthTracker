import * as os from 'os';
import { NetworkAdapter } from '../../shared/types';

/**
 * Infers the network adapter type from its name.
 * Uses common name patterns across Windows, macOS, and Linux.
 *
 * IMPORTANT: Virtual/WSL/Hyper-V adapters whose names contain 'ethernet'
 * as a substring (e.g. 'vEthernet (WSL)') must be excluded BEFORE the
 * generic ethernet check, otherwise they incorrectly return 'ethernet'.
 * The caller should also run isVirtualAdapter() separately; this function
 * returns 'unknown' for anything that looks virtual.
 */
export function inferAdapterType(
  name: string
): NetworkAdapter['type'] {
  const n = name.toLowerCase();

  // ── Virtual / WSL / Hyper-V guard (must come first) ─────────────────
  // Names like 'vEthernet (WSL)', 'veth0', 'Hyper-V Virtual Ethernet Adapter'
  // contain 'ethernet' as a substring but are NOT real ethernet adapters.
  if (
    n.startsWith('vethernet') ||
    n.startsWith('veth') ||
    n.includes('hyper-v') ||
    n.includes('virtual ethernet')
  ) {
    return 'unknown';
  }

  // ── Wi-Fi ─────────────────────────────────────────────────────────────
  if (
    n.includes('wi-fi') ||
    n.includes('wifi') ||
    n.includes('wireless') ||
    n.includes('wlan') ||
    n.includes('802.11') ||
    n.includes('airport') ||
    /^wlp/.test(n) ||
    /^wlan/.test(n)
  ) {
    return 'wifi';
  }

  // ── Ethernet ──────────────────────────────────────────────────────────
  if (
    n.includes('ethernet') ||
    n.includes('local area connection') ||
    n.includes('realtek') ||
    n.includes('intel(r) ethernet') ||
    /^eth/.test(n) ||
    /^enp/.test(n) ||
    /^eno/.test(n) ||
    /^en\d/.test(n)   // macOS: en0, en1
  ) {
    return 'ethernet';
  }

  // ── Cellular ──────────────────────────────────────────────────────────
  if (
    n.includes('cellular') ||
    n.includes('mobile') ||
    n.includes('lte') ||
    n.includes('3g') ||
    n.includes('4g') ||
    n.includes('5g') ||
    n.includes('wwan') ||
    /^ppp/.test(n)    // ppp0 — cellular/dialup
  ) {
    return 'cellular';
  }

  return 'unknown';
}

/**
 * Alias used by tests — same as inferAdapterType.
 */
export const detectAdapterType = inferAdapterType;

/**
 * Determines adapter status based on whether it has assigned IP addresses.
 * active  = has at least one non-internal, non-APIPA IPv4 address
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
 * Returns true when the adapter has a usable (non-internal, non-APIPA,
 * non-zero) IPv4 address — i.e. it is actively connected.
 * This is the boolean form of inferAdapterStatus used by tests.
 */
export function isAdapterActive(ifaces: os.NetworkInterfaceInfo[]): boolean {
  if (!ifaces || ifaces.length === 0) return false;
  return ifaces.some(
    (i) =>
      i.family === 'IPv4' &&
      !i.internal &&
      i.address !== '0.0.0.0' &&
      !i.address.startsWith('169.254.')
  );
}

/**
 * Normalises a raw MAC address to lowercase xx:xx:xx:xx:xx:xx format.
 */
export function normalizeMac(mac: string): string {
  if (!mac || mac === '00:00:00:00:00:00') return mac;
  return mac.toLowerCase().replace(/-/g, ':').trim();
}

/**
 * Formats a MAC address in uppercase XX:XX:XX:XX:XX:XX format.
 * Used by tests as formatMac.
 */
export function formatMac(mac: string): string {
  if (!mac) return '';
  return mac.toUpperCase().replace(/-/g, ':').trim();
}

/**
 * Returns true for adapters that should be excluded from tracking:
 * loopback, VMs, VPN tunnels, Docker bridges, etc.
 */
export function isVirtualAdapter(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n === 'lo' ||
    n.startsWith('loopback') ||
    n.includes('pseudo') ||
    n.includes('vmware') ||
    n.includes('virtualbox') ||
    n.includes('vethernet') ||
    n.includes('docker') ||
    n.includes('hyper-v') ||
    n.includes('teredo') ||
    n.startsWith('tun') ||
    n.startsWith('tap') ||
    n.startsWith('veth') ||
    n.startsWith('br-') ||
    n.startsWith('virbr')
  );
}

/**
 * Returns true when the adapter is a physical (non-virtual) network interface.
 * Inverse of isVirtualAdapter.
 */
export function isPhysicalAdapter(name: string): boolean {
  return !isVirtualAdapter(name);
}

/**
 * Returns a numeric sort priority for a given adapter type.
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
 * Sorts adapters: active first, then by type priority.
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
