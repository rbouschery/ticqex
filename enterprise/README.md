# Enterprise

This directory is reserved for **premium and hosted features** that are not part of the MIT-licensed core.

## Open-core model

Following the [Chatwoot model](https://github.com/chatwoot/chatwoot):

| | Core (repo root) | Enterprise (this directory) |
|---|---|---|
| **License** | MIT | Separate commercial license (TBD) |
| **Includes** | Full self-hostable support desk | Multi-tenant, SSO, audit log, analytics, etc. |
| **Required to run** | No | No — core works without this |

## Planned enterprise features

Nothing here yet. Candidates for future development:

- Multi-tenant workspace management
- SSO / SAML authentication
- Audit log and compliance exports
- Advanced analytics and reporting
- SLA policies and due dates
- Managed hosting (Ticqex Cloud)
- Priority support

## For contributors

- All core development happens in the repo root
- Do not import from `/enterprise` in core code
- Enterprise code may import from core
- When adding a feature, decide: core (MIT) or enterprise (commercial)? Default to core unless it clearly serves hosted/multi-tenant customers only

See [docs/VISION.md](../docs/VISION.md) for the full open-core strategy.
