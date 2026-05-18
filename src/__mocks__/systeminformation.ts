/**
 * Jest mock for systeminformation.
 *
 * systeminformation makes real OS/network calls that are unavailable in CI.
 * Tests that need specific behaviour use jest.mock('systeminformation') with
 * custom return values.  This file is the default fallback that prevents
 * the module from being loaded at all during the test run.
 */
const si = {
  networkStats:      jest.fn().mockResolvedValue([]),
  networkInterfaces: jest.fn().mockResolvedValue([]),
  networkConnections: jest.fn().mockResolvedValue([]),
};

export default si;
module.exports = { __esModule: true, default: si, ...si };
