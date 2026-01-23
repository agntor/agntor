import jwt from 'jsonwebtoken';
import {
  AuditTicketPayload,
  TicketGenerationOptions,
  TicketIssuerConfig,
  ValidationResult,
  X402PaymentProof,
} from './types.js';

/**
 * Agntor Ticket Issuer
 * 
 * Generates and validates cryptographic audit tickets for agent trust verification.
 * Supports sub-second validation for real-time agent-to-agent transactions.
 */
export class TicketIssuer {
  private config: Required<TicketIssuerConfig>;

  constructor(config: TicketIssuerConfig) {
    this.config = {
      algorithm: 'HS256',
      defaultValidity: 300, // 5 minutes
      publicKey: config.publicKey || config.signingKey,
      ...config,
    };
  }

  /**
   * Generate a new audit ticket for an agent
   * 
   * @param options - Ticket generation options
  * @returns JWT token string (X-AGNTOR-Proof header value)
   */
  generateTicket(options: TicketGenerationOptions): string {
    const now = Math.floor(Date.now() / 1000);
    const validityDuration = options.validityDuration ?? this.config.defaultValidity;

    const constraints = {
      ...options.constraints,
      requires_x402_payment: options.constraints.requires_x402_payment ?? true,
    };

    const payload: AuditTicketPayload = {
      iss: this.config.issuer,
      sub: options.agentId,
      iat: now,
      exp: now + validityDuration,
      audit_level: options.auditLevel,
      constraints,
      metadata: options.metadata,
    };

    return jwt.sign(payload, this.config.signingKey, {
      algorithm: this.config.algorithm,
    });
  }

  /**
   * Validate an audit ticket
   * 
   * @param token - JWT token to validate
   * @returns Validation result with decoded payload or error
   */
  async validateTicket(token: string): Promise<ValidationResult> {
    try {
      const decoded = jwt.verify(token, this.config.publicKey, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
      }) as AuditTicketPayload;

      // Check if kill switch is active
      if (decoded.constraints.kill_switch_active) {
        return {
          valid: false,
          error: 'Agent kill switch is active',
          errorCode: 'KILL_SWITCH',
        };
      }

      return {
        valid: true,
        payload: decoded,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'Ticket has expired',
          errorCode: 'EXPIRED',
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: error.message,
          errorCode: 'INVALID_SIGNATURE',
        };
      }

      return {
        valid: false,
        error: 'Invalid ticket format',
        errorCode: 'INVALID_FORMAT',
      };
    }
  }

  /**
   * Synchronous ticket validation (for performance-critical paths)
   * 
   * Note: Does not support async key fetching
   */
  validateTicketSync(token: string): ValidationResult {
    try {
      const decoded = jwt.verify(token, this.config.publicKey, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
      }) as AuditTicketPayload;

      if (decoded.constraints.kill_switch_active) {
        return {
          valid: false,
          error: 'Agent kill switch is active',
          errorCode: 'KILL_SWITCH',
        };
      }

      return {
        valid: true,
        payload: decoded,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'Ticket has expired',
          errorCode: 'EXPIRED',
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: error.message,
          errorCode: 'INVALID_SIGNATURE',
        };
      }

      return {
        valid: false,
        error: 'Invalid ticket format',
        errorCode: 'INVALID_FORMAT',
      };
    }
  }

  /**
   * Validate transaction constraints against ticket
   * 
   * @param token - JWT token
   * @param transactionValue - Dollar value of transaction
   * @param mcpServer - MCP server being accessed (optional)
   * @returns Validation result
   */
  async validateTransaction(
    token: string,
    transactionValue: number,
    mcpServer?: string,
    paymentContext?: { protocol?: string; x402Proof?: X402PaymentProof }
  ): Promise<ValidationResult> {
    const result = await this.validateTicket(token);

    if (!result.valid || !result.payload) {
      return result;
    }

    // Check transaction value constraint
    if (transactionValue > result.payload.constraints.max_op_value) {
      return {
        valid: false,
        error: `Transaction value $${transactionValue} exceeds limit $${result.payload.constraints.max_op_value}`,
        errorCode: 'CONSTRAINT_VIOLATION',
        payload: result.payload,
      };
    }

    // Check MCP server whitelist
    if (mcpServer && !result.payload.constraints.allowed_mcp_servers.includes(mcpServer)) {
      return {
        valid: false,
        error: `MCP server "${mcpServer}" not in allowed list`,
        errorCode: 'CONSTRAINT_VIOLATION',
        payload: result.payload,
      };
    }

    // Enforce x402-only criteria if required
    if (result.payload.constraints.requires_x402_payment) {
      if (paymentContext?.protocol !== 'x402') {
        return {
          valid: false,
          error: 'x402 payment protocol required',
          errorCode: 'CONSTRAINT_VIOLATION',
          payload: result.payload,
        };
      }

      if (!paymentContext.x402Proof?.txHash) {
        return {
          valid: false,
          error: 'Missing x402 payment proof',
          errorCode: 'CONSTRAINT_VIOLATION',
          payload: result.payload,
        };
      }
    }

    return result;
  }

  /**
   * Decode a ticket without validation (for debugging)
   * 
   * WARNING: Do not use this for security-critical paths
   */
  decodeTicket(token: string): AuditTicketPayload | null {
    try {
      return jwt.decode(token) as AuditTicketPayload;
    } catch {
      return null;
    }
  }
}
