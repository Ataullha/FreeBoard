# Security policy

FreeBoard is a browser-local release candidate. Its current verification scope and limitations are documented in [docs/VERIFICATION.md](docs/VERIFICATION.md). Use the latest revision and keep downloadable backups of important work.

## Report a vulnerability

Do not publish exploit details, private boards, credentials or personal information in a public issue or pull request. If the repository's Security tab offers **Report a vulnerability**, use that private reporting flow. If private reporting is unavailable, open an issue containing only a request for a private reporting channel and wait for a maintainer before sharing details.

A useful private report describes the affected revision, browser, reproduction steps using synthetic data, potential impact, and any suggested mitigation. Please allow time to investigate before public disclosure. There is no paid bug-bounty program or guaranteed response deadline.

## Security boundaries

Board and image data are stored in the browser, not an account-isolated cloud service. Anyone with access to that browser profile can access local boards. Browser data can be cleared or evicted. Imports deliberately reject active embeds, remote images and SVG image uploads. These boundaries should remain intact in contributions.
