# Domain modules

Each bounded module owns its domain rules, application use cases, ports, and persistence contracts. UI and route
handlers call authorized use cases; they do not access MongoDB or provider SDKs directly. Cross-module access goes
through typed public interfaces rather than another module's collections.

Modules are introduced only by the active Genesis milestone. M0 intentionally creates this boundary without
pre-building identity, catalog, booking, payments, or future travel modules.
