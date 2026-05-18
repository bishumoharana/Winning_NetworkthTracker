/**
 * Jest mock for src/main/network/adapterDetector.
 *
 * The real implementation calls os.networkInterfaces() which reads live OS
 * network state. We mock it so NetworkMonitor tests are fully isolated and
 * never depend on the host machine's network configuration.
 */
import { NetworkAdapter } from '../shared/types';

export const getNetworkAdapters = jest.fn((): NetworkAdapter[] => [
  { name: 'eth0', mac: 'aa:bb:cc:00:00:01', type: 'ethernet', status: 'active' },
]);
