import * as os from 'os';
import {
  getNetworkAdapters,
  getActiveAdapters,
  getPrimaryAdapter,
} from '../network/adapterDetector';

// ---------------------------------------------------------------------------
// Mock os.networkInterfaces()
// ---------------------------------------------------------------------------
jest.mock('os');
const mockedOs = os as jest.Mocked<typeof os>;

const MOCK_INTERFACES: Record<string, os.NetworkInterfaceInfo[]> = {
  'Wi-Fi': [
    {
      address: '192.168.1.50',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: 'aa:bb:cc:dd:ee:01',
      internal: false,
      cidr: '192.168.1.50/24',
    },
    {
      address: 'fe80::1',
      netmask: 'ffff:ffff:ffff:ffff::',
      family: 'IPv6',
      mac: 'aa:bb:cc:dd:ee:01',
      internal: false,
      cidr: 'fe80::1/64',
    },
  ],
  'Ethernet': [
    {
      address: '10.0.0.5',
      netmask: '255.255.0.0',
      family: 'IPv4',
      mac: 'aa:bb:cc:dd:ee:02',
      internal: false,
      cidr: '10.0.0.5/16',
    },
  ],
  'Loopback Pseudo-Interface 1': [
    {
      address: '127.0.0.1',
      netmask: '255.0.0.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: true,
      cidr: '127.0.0.1/8',
    },
  ],
  'Disconnected Adapter': [
    {
      address: '169.254.100.1',
      netmask: '255.255.0.0',
      family: 'IPv4',
      mac: 'aa:bb:cc:dd:ee:03',
      internal: false,
      cidr: '169.254.100.1/16',
    },
  ],
};

beforeEach(() => {
  mockedOs.networkInterfaces.mockReturnValue(MOCK_INTERFACES as any);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getNetworkAdapters
// ---------------------------------------------------------------------------
describe('getNetworkAdapters', () => {
  it('returns an array of NetworkAdapter objects', () => {
    const adapters = getNetworkAdapters();
    expect(Array.isArray(adapters)).toBe(true);
    expect(adapters.length).toBeGreaterThan(0);
  });

  it('detects Wi-Fi adapter with correct type', () => {
    const adapters = getNetworkAdapters();
    const wifi = adapters.find((a) => a.name === 'Wi-Fi');
    expect(wifi).toBeDefined();
    expect(wifi?.type).toBe('wifi');
  });

  it('detects Ethernet adapter with correct type', () => {
    const adapters = getNetworkAdapters();
    const eth = adapters.find((a) => a.name === 'Ethernet');
    expect(eth).toBeDefined();
    expect(eth?.type).toBe('ethernet');
  });

  it('marks Wi-Fi as active (has valid IPv4)', () => {
    const adapters = getNetworkAdapters();
    const wifi = adapters.find((a) => a.name === 'Wi-Fi');
    expect(wifi?.status).toBe('active');
  });

  it('marks Ethernet as active (has valid IPv4)', () => {
    const adapters = getNetworkAdapters();
    const eth = adapters.find((a) => a.name === 'Ethernet');
    expect(eth?.status).toBe('active');
  });

  it('marks APIPA adapter as inactive', () => {
    const adapters = getNetworkAdapters();
    const disc = adapters.find((a) => a.name === 'Disconnected Adapter');
    expect(disc?.status).toBe('inactive');
  });

  it('extracts correct MAC address for Wi-Fi', () => {
    const adapters = getNetworkAdapters();
    const wifi = adapters.find((a) => a.name === 'Wi-Fi');
    expect(wifi?.mac).toBe('aa:bb:cc:dd:ee:01');
  });

  it('extracts IPv4 address for Wi-Fi', () => {
    const adapters = getNetworkAdapters();
    const wifi = adapters.find((a) => a.name === 'Wi-Fi');
    expect(wifi?.ipv4).toBe('192.168.1.50');
  });

  it('sorts active adapters before inactive ones', () => {
    const adapters = getNetworkAdapters();
    const firstInactiveIndex = adapters.findIndex((a) => a.status === 'inactive');
    const lastActiveIndex = adapters.reduce(
      (last, a, i) => (a.status === 'active' ? i : last),
      -1
    );
    if (firstInactiveIndex !== -1 && lastActiveIndex !== -1) {
      expect(lastActiveIndex).toBeLessThan(firstInactiveIndex);
    }
  });

  it('does not include loopback as a separate active adapter (127.0.0.1 is internal)', () => {
    const adapters = getNetworkAdapters();
    const loopback = adapters.find((a) => a.ipv4 === '127.0.0.1');
    // Loopback may be included but must not be active
    if (loopback) {
      expect(loopback.status).toBe('inactive');
    }
  });

  it('returns empty array when os.networkInterfaces returns empty', () => {
    mockedOs.networkInterfaces.mockReturnValueOnce({});
    const adapters = getNetworkAdapters();
    expect(adapters).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getActiveAdapters
// ---------------------------------------------------------------------------
describe('getActiveAdapters', () => {
  it('returns only active adapters', () => {
    const active = getActiveAdapters();
    expect(active.every((a) => a.status === 'active')).toBe(true);
  });

  it('returns at least one active adapter in normal mock', () => {
    const active = getActiveAdapters();
    expect(active.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when no active interfaces exist', () => {
    mockedOs.networkInterfaces.mockReturnValueOnce({
      lo: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' }],
    } as any);
    expect(getActiveAdapters()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getPrimaryAdapter
// ---------------------------------------------------------------------------
describe('getPrimaryAdapter', () => {
  it('returns non-null when adapters exist', () => {
    expect(getPrimaryAdapter()).not.toBeNull();
  });

  it('prefers Ethernet over Wi-Fi as primary', () => {
    const primary = getPrimaryAdapter();
    // Both Ethernet and Wi-Fi are active in mock; Ethernet should win
    expect(primary?.type).toBe('ethernet');
  });

  it('falls back to Wi-Fi if no Ethernet active', () => {
    const wifiOnly: Record<string, os.NetworkInterfaceInfo[]> = {
      'Wi-Fi': MOCK_INTERFACES['Wi-Fi'],
    };
    mockedOs.networkInterfaces.mockReturnValueOnce(wifiOnly as any);
    const primary = getPrimaryAdapter();
    expect(primary?.type).toBe('wifi');
  });

  it('returns null when no active adapters exist', () => {
    mockedOs.networkInterfaces.mockReturnValueOnce({} as any);
    expect(getPrimaryAdapter()).toBeNull();
  });
});
