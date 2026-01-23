# Contributing to @agntor/sdk

Thank you for your interest in contributing to the Agntor SDK!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/agntor-protocol/sdk.git
cd sdk

# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev
```

## Testing Your Changes

The SDK is used by both the Trust Proxy and examples. After making changes:

```bash
# 1. Build your changes
npm run build

# 2. Test with the x402 example
cd ../../examples/basic-x402
npm run dev
```

## Code Style

- Use TypeScript strict mode
- Export all public types from `src/types.ts`
- Keep the SDK dependency-free (zero external dependencies)
- Follow existing naming conventions

## What We're Looking For

- **Performance optimizations**: The SDK must validate tickets in <5ms
- **New algorithms**: Support for ES256, RS512, etc.
- **Better error messages**: Make debugging easier for developers
- **Documentation improvements**: Real-world usage examples

## Pull Request Guidelines

1. Ensure all types are exported in `src/index.ts`
2. Update the README.md if you add new methods
3. Keep changes focused and atomic
4. Add inline comments for complex crypto operations

## Architecture Notes

The SDK is the **core primitive** of Agntor:
- `issuer.ts`: Ticket generation and validation logic
- `types.ts`: All TypeScript interfaces
- Zero runtime dependencies to keep bundle size minimal

## Questions?

Open an issue or reach out at https://github.com/agntor-protocol/sdk/issues
