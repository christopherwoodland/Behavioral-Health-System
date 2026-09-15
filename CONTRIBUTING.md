# Contributing to MindBridge

Thank you for contributing. This project handles behavioral-health workflows, so changes should prioritize privacy, accessibility, clinical clarity, and deterministic safety checks around AI-generated output.

## Before You Start

- Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md).
- Open an issue before a large behavioral, API, data-model, or infrastructure change.
- Never include patient data, credentials, tokens, model artifacts without redistribution rights, or proprietary DSM-5 source material in commits or issues.
- Keep changes focused. Preserve compatibility unless the issue explicitly approves a breaking change.

## Development Setup

Requirements:

- .NET 10 SDK
- Node.js 22 or later and npm
- Azure Functions Core Tools v4 for local Functions execution
- Docker Desktop for the complete local stack

Build and test the backend:

```powershell
dotnet restore BehavioralHealthSystem.sln
dotnet build BehavioralHealthSystem.sln --no-restore
dotnet test BehavioralHealthSystem.Tests/BehavioralHealthSystem.Tests.csproj --no-build
```

Build and test the frontend:

```powershell
cd BehavioralHealthSystem.Web
npm ci
npm run lint
npm run test:run
npm run build
```

Configuration examples are provided in `docker.env.example` and `BehavioralHealthSystem.Functions/local.settings.json.template`. Store real values only in ignored local files or an approved secret store.

## Engineering Expectations

- Follow `.editorconfig` and existing project conventions.
- Add or update focused tests for behavior changes.
- Treat Extended assessment as the only user-facing clinical assessment. Keep immediate safety risk, DSM-5 condition likelihood, and the unverified DAM signal separate.
- Fail closed when patient-specific safety evidence is insufficient: `evidenceSufficiency` is `Insufficient`, `overallRiskLevel` is `Indeterminate`, and `riskScore` is `0`.
- Prefer managed identity and secret references for Azure resources.
- Include accessible names, keyboard behavior, and responsive layouts for frontend changes.
- Update relevant READMEs, examples, scripts, and infrastructure templates when contracts or configuration change.

## Pull Requests

Describe the problem, the approach, validation performed, security/privacy impact, and any deployment or migration steps. CI must pass. Reviewers may request additional testing for shared contracts, clinical presentation, authentication, storage, or infrastructure changes.

By contributing, you agree that your contributions are licensed under the repository's [MIT License](LICENSE).
