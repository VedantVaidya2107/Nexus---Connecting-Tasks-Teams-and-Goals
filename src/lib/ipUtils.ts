/**
 * IP Utility functions for WiFi/network-based attendance validation.
 *
 * Since browsers cannot expose WiFi SSID names, we validate using
 * the client's IP address — if they're on the office network,
 * their request IP will fall within the admin-configured allowed range.
 */

/**
 * Extract the real client IP from Next.js request headers.
 * Handles proxies (Vercel, Nginx, Cloudflare) via x-forwarded-for.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for may contain multiple IPs: "client, proxy1, proxy2"
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP.trim();

  // Fallback — CF-Connecting-IP (Cloudflare)
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP.trim();

  return 'unknown';
}

/**
 * Check if an IPv4 address is within a CIDR block.
 * Supports both exact IPs (e.g., "192.168.1.100") and
 * CIDR notation (e.g., "192.168.1.0/24", "10.0.0.0/8").
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) {
    // Exact IP match
    return ip === cidr;
  }

  const [range, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);

  if (isNaN(bits) || bits < 0 || bits > 32) return false;

  const ipParts = ip.split('.').map(Number);
  const rangeParts = range.split('.').map(Number);

  if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
  if (ipParts.some(isNaN) || rangeParts.some(isNaN)) return false;

  const ipInt = ipParts.reduce((acc, val) => (acc << 8) | val, 0) >>> 0;
  const rangeInt = rangeParts.reduce((acc, val) => (acc << 8) | val, 0) >>> 0;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;

  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * Check if a given IP is in the admin-configured allowed list.
 * Each entry can be:
 *   - An exact IP: "192.168.1.50"
 *   - A CIDR range: "192.168.1.0/24" or "10.0.0.0/8"
 * Returns false if the allowed list is empty (locks down check-in until configured).
 */
export function isIPAllowed(ip: string, allowedList: string[]): boolean {
  if (!allowedList || allowedList.length === 0) return false;
  if (ip === 'unknown') return false;

  for (const entry of allowedList) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (isIPInCIDR(ip, trimmed)) return true;
  }

  return false;
}
