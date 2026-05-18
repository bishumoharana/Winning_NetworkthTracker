import {
  detectAdapterType,
  isAdapterActive,
  formatMac,
  isPhysicalAdapter,
} from '../network/adapterUtils';
import * as os from 'os';

type NetworkInterfaceInfo = os.NetworkInterfaceInfo;

// ---------------------------------------------------------------------------
// detectAdapterType
// ---------------------------------------------------------------------------
describe('detectAdapterType', () => {
  // WiFi
  it('detects Wi-Fi (Windows name)', () => {
    expect(detectAdapterType('Wi-Fi')).toBe('wifi');
  });
  it('detects wlan0 (Linux)', () => {
    expect(detectAdapterType('wlan0')).toBe('wifi');
  });
  it('detects Wireless Network Connection', () => {
    expect(detectAdapterType('Wireless Network Connection')).toBe('wifi');
  });
  it('detects AirPort (macOS legacy)', () => {
    expect(detectAdapterType('AirPort')).toBe('wifi');
  });

  // Ethernet
  it('detects Ethernet (Windows)', () => {
    expect(detectAdapterType('Ethernet')).toBe('ethernet');
  });
  it('detects eth0 (Linux)', () => {
    expect(detectAdapterType('eth0')).toBe('ethernet');
  });
  it('detects en0 (macOS)', () => {
    expect(detectAdapterType('en0')).toBe('ethernet');
  });
  it('detects enp3s0 (Linux PCI ethernet)', () => {
    expect(detectAdapterType('enp3s0')).toBe('ethernet');
  });
  it('detects Local Area Connection', () => {
    expect(detectAdapterType('Local Area Connection')).toBe('ethernet');
  });

  // Cellular
  it('detects WWAN adapter', () => {
    expect(detectAdapterType('WWAN Adapter')).toBe('cellular');
  });
  it('detects ppp0 (cellular/dialup)', () => {
    expect(detectAdapterType('ppp0')).toBe('cellular');
  });

  // Unknown
  it('returns unknown for VPN/virtual adapter names', () => {
    expect(detectAdapterType('Tailscale')).toBe('unknown');
  });
  it('returns unknown for unrecognized name', () => {
    expect(detectAdapterType('xyz999')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// isAdapterActive
// ---------------------------------------------------------------------------
describe('isAdapterActive', () => {
  const makeAddr = (overrides: Partial<NetworkInterfaceInfo>): NetworkInterfaceInfo => ({
    address: '192.168.1.100',
    netmask: '255.255.255.0',
    family: 'IPv4',
    mac: 'aa:bb:cc:dd:ee:ff',
    internal: false,
    cidr: '192.168.1.100/24',
    ...overrides,
  });

  it('returns true for normal IPv4 address', () => {
    expect(isAdapterActive([makeAddr({})])).toBe(true);
  });

  it('returns false for internal/loopback address', () => {
    expect(isAdapterActive([makeAddr({ internal: true, address: '127.0.0.1' })])).toBe(false);
  });

  it('returns false for APIPA address (169.254.x.x)', () => {
    expect(isAdapterActive([makeAddr({ address: '169.254.0.1' })])).toBe(false);
  });

  it('returns false for 0.0.0.0', () => {
    expect(isAdapterActive([makeAddr({ address: '0.0.0.0' })])).toBe(false);
  });

  it('returns false for IPv6-only adapter', () => {
    expect(isAdapterActive([makeAddr({ family: 'IPv6', address: '::1' })])).toBe(false);
  });

  it('returns true when mixed IPv4 valid + IPv6 entries', () => {
    expect(
      isAdapterActive([
        makeAddr({ family: 'IPv6', address: 'fe80::1' }),
        makeAddr({ address: '10.0.0.5' }),
      ])
    ).toBe(true);
  });

  it('returns false for empty address list', () => {
    expect(isAdapterActive([])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatMac
// ---------------------------------------------------------------------------
describe('formatMac', () => {
  it('uppercases lowercase mac', () => {
    expect(formatMac('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF');
  });
  it('leaves already-uppercase mac unchanged', () => {
    expect(formatMac('AA:BB:CC:DD:EE:FF')).toBe('AA:BB:CC:DD:EE:FF');
  });
  it('returns empty string for empty input', () => {
    expect(formatMac('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// isPhysicalAdapter
// ---------------------------------------------------------------------------
describe('isPhysicalAdapter', () => {
  it('returns true for Wi-Fi', () => {
    expect(isPhysicalAdapter('Wi-Fi')).toBe(true);
  });
  it('returns true for Ethernet', () => {
    expect(isPhysicalAdapter('Ethernet')).toBe(true);
  });
  it('returns false for Loopback adapter', () => {
    expect(isPhysicalAdapter('Loopback Pseudo-Interface')).toBe(false);
  });
  it('returns false for VMware adapter', () => {
    expect(isPhysicalAdapter('VMware Network Adapter VMnet1')).toBe(false);
  });
  it('returns false for docker bridge', () => {
    expect(isPhysicalAdapter('br-abc123')).toBe(false);
  });
  it('returns false for veth (Docker container)', () => {
    expect(isPhysicalAdapter('veth0a1b2c')).toBe(false);
  });
  it('returns false for tun0 (VPN tunnel)', () => {
    expect(isPhysicalAdapter('tun0')).toBe(false);
  });
});
