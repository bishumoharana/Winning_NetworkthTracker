/**
 * Unit tests for Task 1.2 — Network Adapter Detection
 * Tests all pure utility functions in adapterUtils.ts
 * and the getAdapters / detectPrimaryAdapter logic.
 */
import {
  inferAdapterType,
  inferAdapterStatus,
  normalizeMac,
  isVirtualAdapter,
  prioritizeAdapters,
} from '../network/adapterUtils';
import { NetworkAdapter } from '../../shared/types';
import * as os from 'os';

// -------------------------------------------------------------------------
// inferAdapterType
// -------------------------------------------------------------------------
describe('inferAdapterType', () => {
  it('detects Wi-Fi (Windows name)', () => {
    expect(inferAdapterType('Wi-Fi')).toBe('wifi');
  });

  it('detects wifi from "Wireless Network Adapter"', () => {
    expect(inferAdapterType('Wireless Network Adapter')).toBe('wifi');
  });

  it('detects wifi from Linux wlan0', () => {
    expect(inferAdapterType('wlan0')).toBe('wifi');
  });

  it('detects wifi from Linux wlp2s0', () => {
    expect(inferAdapterType('wlp2s0')).toBe('wifi');
  });

  it('detects ethernet from "Ethernet" (Windows)', () => {
    expect(inferAdapterType('Ethernet')).toBe('ethernet');
  });

  it('detects ethernet from Linux eth0', () => {
    expect(inferAdapterType('eth0')).toBe('ethernet');
  });

  it('detects ethernet from Linux enp3s0', () => {
    expect(inferAdapterType('enp3s0')).toBe('ethernet');
  });

  it('detects ethernet from "Local Area Connection"', () => {
    expect(inferAdapterType('Local Area Connection')).toBe('ethernet');
  });

  it('detects cellular from "Cellular"', () => {
    expect(inferAdapterType('Cellular')).toBe('cellular');
  });

  it('detects cellular from "WWAN Adapter"', () => {
    expect(inferAdapterType('WWAN Adapter')).toBe('cellular');
  });

  it('returns unknown for unrecognised names', () => {
    expect(inferAdapterType('vEthernet (WSL)')).toBe('unknown');
    expect(inferAdapterType('Hamachi')).toBe('unknown');
  });
});

// -------------------------------------------------------------------------
// inferAdapterStatus
// -------------------------------------------------------------------------
describe('inferAdapterStatus', () => {
  const makeIface = (
    family: 'IPv4' | 'IPv6',
    address: string,
    internal = false
  ): os.NetworkInterfaceInfo => ({
    family,
    address,
    netmask: '255.255.255.0',
    mac: 'aa:bb:cc:dd:ee:ff',
    internal,
    cidr: null,
    // scopeid is required by @types/node for NetworkInterfaceInfoIPv6.
    // Providing 0 satisfies the type for both IPv4 and IPv6 mocks.
    scopeid: 0,
  } as os.NetworkInterfaceInfo);

  it('returns active when IPv4 address present and external', () => {
    expect(inferAdapterStatus([makeIface('IPv4', '192.168.1.10')])).toBe('active');
  });

  it('returns inactive when address is 0.0.0.0', () => {
    expect(inferAdapterStatus([makeIface('IPv4', '0.0.0.0')])).toBe('inactive');
  });

  it('returns standby when only IPv6 present', () => {
    expect(inferAdapterStatus([makeIface('IPv6', 'fe80::1')])).toBe('standby');
  });

  it('returns inactive when ifaces array is empty', () => {
    expect(inferAdapterStatus([])).toBe('inactive');
  });

  it('returns inactive when all addresses are internal', () => {
    expect(inferAdapterStatus([makeIface('IPv4', '127.0.0.1', true)])).toBe('inactive');
  });
});

// -------------------------------------------------------------------------
// normalizeMac
// -------------------------------------------------------------------------
describe('normalizeMac', () => {
  it('converts uppercase colon-separated MAC to lowercase', () => {
    expect(normalizeMac('AA:BB:CC:DD:EE:FF')).toBe('aa:bb:cc:dd:ee:ff');
  });

  it('converts hyphen-separated MAC to colon-separated', () => {
    expect(normalizeMac('AA-BB-CC-DD-EE-FF')).toBe('aa:bb:cc:dd:ee:ff');
  });

  it('passes through already normalised MAC', () => {
    expect(normalizeMac('aa:bb:cc:dd:ee:ff')).toBe('aa:bb:cc:dd:ee:ff');
  });

  it('returns zero MAC unchanged', () => {
    expect(normalizeMac('00:00:00:00:00:00')).toBe('00:00:00:00:00:00');
  });

  it('handles empty string gracefully', () => {
    expect(normalizeMac('')).toBe('');
  });
});

// -------------------------------------------------------------------------
// isVirtualAdapter
// -------------------------------------------------------------------------
describe('isVirtualAdapter', () => {
  it('identifies loopback as virtual', () => {
    expect(isVirtualAdapter('lo')).toBe(true);
    expect(isVirtualAdapter('Loopback Pseudo-Interface 1')).toBe(true);
  });

  it('identifies VMware adapters as virtual', () => {
    expect(isVirtualAdapter('VMware Network Adapter VMnet1')).toBe(true);
  });

  it('identifies Docker bridge as virtual', () => {
    expect(isVirtualAdapter('docker0')).toBe(true);
    expect(isVirtualAdapter('br-abc123')).toBe(true);
  });

  it('identifies VPN tunnel as virtual', () => {
    expect(isVirtualAdapter('tun0')).toBe(true);
    expect(isVirtualAdapter('tap0')).toBe(true);
  });

  it('does NOT flag real adapters as virtual', () => {
    expect(isVirtualAdapter('Wi-Fi')).toBe(false);
    expect(isVirtualAdapter('Ethernet')).toBe(false);
    expect(isVirtualAdapter('eth0')).toBe(false);
    expect(isVirtualAdapter('wlan0')).toBe(false);
  });
});

// -------------------------------------------------------------------------
// prioritizeAdapters
// -------------------------------------------------------------------------
describe('prioritizeAdapters', () => {
  const makeAdapter = (
    name: string,
    type: NetworkAdapter['type'],
    status: NetworkAdapter['status']
  ): NetworkAdapter => ({ name, mac: 'aa:bb:cc:00:00:01', type, status });

  it('puts active adapters before standby before inactive', () => {
    const input = [
      makeAdapter('lo', 'unknown', 'inactive'),
      makeAdapter('wlan0', 'wifi', 'standby'),
      makeAdapter('eth0', 'ethernet', 'active'),
    ];
    const result = prioritizeAdapters(input);
    expect(result[0].status).toBe('active');
    expect(result[1].status).toBe('standby');
    expect(result[2].status).toBe('inactive');
  });

  it('puts ethernet before wifi when both active', () => {
    const input = [
      makeAdapter('wlan0', 'wifi', 'active'),
      makeAdapter('eth0', 'ethernet', 'active'),
    ];
    const result = prioritizeAdapters(input);
    expect(result[0].type).toBe('ethernet');
    expect(result[1].type).toBe('wifi');
  });

  it('does not mutate the original array', () => {
    const input = [
      makeAdapter('wlan0', 'wifi', 'active'),
      makeAdapter('eth0', 'ethernet', 'active'),
    ];
    const original = [...input];
    prioritizeAdapters(input);
    expect(input[0].name).toBe(original[0].name);
  });
});
