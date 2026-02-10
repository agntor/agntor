import { lookup } from 'node:dns/promises';
import * as ipaddr from 'ipaddr.js';

const MAX_URL_LENGTH = 2048;

/**
 * Check if an IP address is private/internal using ipaddr.js.
 * Supports both IPv4 and IPv6 ranges.
 */
function isPrivateIpAddress(ip: string): boolean {
  try {
    const addr = ipaddr.process(ip);

    if (addr.kind() === 'ipv4') {
      const ipv4 = addr as ipaddr.IPv4;
      return (
        ipv4.range() === 'private' ||
        ipv4.range() === 'loopback' ||
        ipv4.range() === 'linkLocal' ||
        ipv4.range() === 'multicast'
      );
    } else if (addr.kind() === 'ipv6') {
      const ipv6 = addr as ipaddr.IPv6;

      if (ipv6.isIPv4MappedAddress()) {
        const ipv4Mapped = ipv6.toIPv4Address();
        return isPrivateIpAddress(ipv4Mapped.toString());
      }

      const range = ipv6.range();
      return (
        range === 'uniqueLocal' ||
        range === 'linkLocal' ||
        range === 'loopback' ||
        range === 'multicast'
      );
    }

    return false;
  } catch {
    // If IP parsing fails, treat as private (fail-safe)
    return true;
  }
}

/**
 * Check if a hostname resolves to a private/internal IP address.
 *
 * Performs DNS resolution to prevent SSRF attacks where
 * a hostname like "attacker.com" resolves to 127.0.0.1.
 *
 * If DNS resolution fails, treats as private (fail-safe security).
 */
async function isPrivateIp(hostname: string): Promise<boolean> {
  const lowerHostname = hostname.toLowerCase();

  if (
    lowerHostname === 'localhost' ||
    lowerHostname === 'localhost.localdomain' ||
    lowerHostname === 'local' ||
    lowerHostname === '127.0.0.1' ||
    lowerHostname === '::1'
  ) {
    return true;
  }

  const cleanHostname = hostname.replace(/^\[|\]$/g, '');

  try {
    if (ipaddr.isValid(cleanHostname)) {
      return isPrivateIpAddress(cleanHostname);
    }
  } catch {
    // Not a direct IP, continue to DNS resolution
  }

  try {
    const results = await lookup(cleanHostname, { all: true });
    return results.some((r) => isPrivateIpAddress(r.address));
  } catch {
    // DNS resolution failed — treat as private (fail-safe)
    return true;
  }
}

/**
 * Validate a URL for security concerns (SSRF prevention).
 *
 * Checks:
 * - URL format is valid
 * - Protocol is http or https only
 * - Hostname is not empty
 * - No private/internal IP addresses (with DNS resolution)
 * - No localhost access
 * - No file:// protocol
 * - URL length is reasonable (max 2048 characters)
 *
 * Throws `Error` with a descriptive message if the URL is unsafe.
 */
export async function validateUrl(url: string): Promise<void> {
  if (url.length > MAX_URL_LENGTH) {
    throw new Error(
      `Invalid URL: URL exceeds maximum length of ${MAX_URL_LENGTH} characters`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error(`Invalid URL: malformed URL format - ${String(e)}`);
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    if (protocol === 'file:') {
      throw new Error('Invalid URL: file:// protocol is not allowed');
    }
    throw new Error(
      `Invalid URL: protocol must be http or https, got ${protocol}`,
    );
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw new Error('Invalid URL: hostname is required');
  }

  const lowerHostname = hostname.toLowerCase();
  const cleanHostname = hostname.replace(/^\[|\]$/g, '');

  if (
    lowerHostname === 'localhost' ||
    lowerHostname === 'localhost.localdomain' ||
    lowerHostname === 'local' ||
    cleanHostname === '127.0.0.1' ||
    cleanHostname === '::1' ||
    cleanHostname.startsWith('127.')
  ) {
    throw new Error('Invalid URL: localhost access is not allowed');
  }

  const isPrivate = await isPrivateIp(hostname);
  if (isPrivate) {
    throw new Error(
      'Invalid URL: private/internal IP addresses are not allowed',
    );
  }
}

/**
 * Check whether a string looks like a URL.
 */
export function isUrlString(input: string): boolean {
  return (
    input.startsWith('http://') ||
    input.startsWith('https://') ||
    input.startsWith('file://')
  );
}
