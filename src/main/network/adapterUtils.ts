import * as os from 'os';
import { NetworkAdapter } from '../../shared/types';

type NetworkInterfaceInfo = os.NetworkInterfaceInfo;

/**
 * Detects adapter type (wifi/ethernet/cellular/unknown) based on interface name.
 * Works cross-platform: Windows, macOS, Linux.
 */
export function detectAdapterType(
  name: string
): NetworkAdapter['type'] {
  const lower = name.toLowerCase();

  // WiFi patterns
  if (
    lower.includes('wi-fi') ||
    lower.includes('wifi') ||
    lower.includes('wireless') ||
    lower.includes('wlan') ||
    lower.startsWith('wl') ||
    lower.includes('airport')
  ) {
    return 'wifi';
  }

  // Ethernet patterns
  if (
    lower.includes('ethernet') ||
    lower.includes('eth') ||
    lower.includes('local area connection') ||
    lower.startsWith('en') ||
    lower.startsWith('em') ||
    lower.startsWith('eno') ||
    lower.startsWith('enp')
  ) {
    return 'ethernet';
  }

  // Cellular patterns
  if (
    lower.includes('cellular') ||
    lower.includes('mobile') ||
    lower.includes('wwan') ||
    lower.includes('ppp')
  ) {
    return 'cellular';
  }

  // Skip loopback, VPN, virtual adapters — mark unknown
  return 'unknown';
}

/**
 * Determines if an adapter is active based on its address entries.
 * An adapter is active if it has at least one non-loopback, non-link-local IPv4 address.
 */
export function isAdapterActive(addresses: NetworkInterfaceInfo[]): boolean {
  return addresses.some(
    (addr) =>
      addr.family === 'IPv4' &&
      !addr.internal &&
      addr.address !== '0.0.0.0' &&
      !addr.address.startsWith('169.254') // APIPA = no DHCP = not truly active
  );
}

/**
 * Formats a MAC address to uppercase colon-separated format.
 * e.g. "aa:bb:cc:dd:ee:ff" -> "AA:BB:CC:DD:EE:FF"
 */
export function formatMac(mac: string): string {
  if (!mac) return '';
  return mac.toUpperCase();
}

/**
 * Filters out loopback and virtual/internal adapters.
 */
export function isPhysicalAdapter(name: string): boolean {
  const lower = name.toLowerCase();
  const virtualPatterns = [
    'loopback', 'lo', 'vmware', 'virtualbox', 'vbox',
    'hyper-v', 'docker', 'br-', 'veth', 'virbr', 'tun', 'tap',
  ];
  return !virtualPatterns.some((p) => lower.includes(p) || lower === p);
}
