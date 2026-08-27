# Platform boundary

This directory owns server configuration and future infrastructure adapters. Provider SDKs and MongoDB clients stay
here and implement domain-owned ports. Configuration is validated once, cached server-side, and never logged with
secret values.

Environment isolation and transaction capability are required before database-backed booking work begins. EPS
configuration is intentionally absent until official merchant documentation is approved for M6.
