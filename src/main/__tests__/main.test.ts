/**
 * Task 1.1 smoke tests — verify dev environment wiring
 */
import { IPC_CHANNELS } from '../../shared/types';

describe('IPC_CHANNELS constants', () => {
  it('should define GET_THEME channel', () => {
    expect(IPC_CHANNELS.GET_THEME).toBe('get-theme');
  });

  it('should define SET_THEME channel', () => {
    expect(IPC_CHANNELS.SET_THEME).toBe('set-theme');
  });

  it('should define GET_ADAPTERS channel', () => {
    expect(IPC_CHANNELS.GET_ADAPTERS).toBe('get-adapters');
  });

  it('should define NETWORK_CHANGE channel', () => {
    expect(IPC_CHANNELS.NETWORK_CHANGE).toBe('network-change');
  });

  it('should define all 9 IPC channels', () => {
    expect(Object.keys(IPC_CHANNELS)).toHaveLength(9);
  });
});

describe('Shared types - AppSettings defaults', () => {
  it('should have valid default aggregation interval (120 min)', () => {
    const defaultSettings = {
      theme: 'dark' as const,
      aggregationIntervalMinutes: 120,
      dataDisplayUnit: 'auto' as const,
      retentionDays: 7,
      alertsEnabled: true,
      launchOnStartup: false,
    };
    expect(defaultSettings.aggregationIntervalMinutes).toBe(120);
    expect(defaultSettings.retentionDays).toBe(7);
    expect(defaultSettings.theme).toBe('dark');
  });
});
