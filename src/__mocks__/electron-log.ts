/**
 * Jest mock for electron-log.
 * The real module writes to OS-specific log paths that don't exist in CI.
 */
const log = {
  info:    jest.fn(),
  warn:    jest.fn(),
  error:   jest.fn(),
  debug:   jest.fn(),
  verbose: jest.fn(),
  silly:   jest.fn(),
};

module.exports = log;
export default log;
