# Security Policy

## Supported Versions

This repo is pre-1.0. Security fixes target `main` until release branches exist.

## Reporting A Vulnerability

Do not open public issues for secrets, authentication bypasses, or remote
execution concerns. Report privately to the repository owner.

Never commit API keys, MCP bearer tokens, provider keys, or user data. Runtime
credentials belong in environment variables such as `THEOREM_HARNESS_API_TOKEN`
and must not be persisted in capability manifests, fixtures, or tests.
