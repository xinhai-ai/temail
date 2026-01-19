# Versioning & Releases

This project uses **Semantic Versioning** (`MAJOR.MINOR.PATCH`).

## Source of truth

- Project version lives in `package.json` (`version` field).
- Git release tags use the format `vX.Y.Z` and **must match** `package.json`.

## Release steps

1) Ensure you're on a clean working tree on the branch you release from (usually `main`).

2) Bump the version (this creates a commit and a git tag):

```bash
npm run release:patch
# or: npm run release:minor
# or: npm run release:major
```

3) Push the commit and the tag:

```bash
git push
git push --tags
```

GitHub Actions will build and publish release images for that tag.

## Docker image tags

Two images are published:

- `ghcr.io/<owner>/<repo>` (web)
- `ghcr.io/<owner>/<repo>-worker`

**Release builds (git tag `vX.Y.Z`)** publish:

- `X.Y.Z`, `X.Y`, `X`, `latest`

**Dev builds (default branch pushes)** publish:

- `edge`, `sha-<shortsha>`
