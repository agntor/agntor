export const AP2_VERSION = '1.0-draft';
export const AP2_EXTENSION_URI = 'https://github.com/google-agentic-commerce/ap2/tree/v0.1';

export interface AP2Headers {
  'X-AP2-Version': string;
  'X-AP2-Extension-URI': string;
  'X-AP2-Agent-ID'?: string;
  'X-AP2-Roles'?: string;
  'X-AP2-Supported-Methods'?: string;
  'X-AP2-Platform'?: string;
}

export function getAP2Headers(agentId?: string): AP2Headers {
  return {
    'X-AP2-Version': AP2_VERSION,
    'X-AP2-Extension-URI': AP2_EXTENSION_URI,
    'X-AP2-Platform': 'Agntor',
    ...(agentId ? { 'X-AP2-Agent-ID': agentId } : {}),
    'X-AP2-Roles': 'shopper,merchant', // Default roles
    'X-AP2-Supported-Methods': 'x402,escrow,direct'
  };
}

export function parseAP2Headers(headers: Headers) {
    return {
        version: headers.get('X-AP2-Version'),
        agentId: headers.get('X-AP2-Agent-ID'),
        roles: headers.get('X-AP2-Roles')?.split(',') || [],
    };
}
