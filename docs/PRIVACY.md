# FreeBoard privacy information

Effective 21 October 2026. This describes the code as delivered. A hosting owner must update it if adding services.

FreeBoard saves board documents, image assets, thumbnails, soft-deleted boards and recovery drafts in this browser's IndexedDB. It keeps small preferences, including the last board ID, in localStorage. Application code, icons and fonts are cached by the service worker for offline use.

Board contents are not sent to a FreeBoard server. This release has no accounts, telemetry, advertising, trackers, external AI calls, cloud synchronization or collaboration. Runtime fonts and assets are bundled locally. Downloaded backups and exports remain wherever you choose to save them.

The hosting provider receives normal website traffic such as IP addresses, user agents, requested asset paths and timestamps. Its policies apply to those requests. FreeBoard does not control hosting logs or any browser extensions you install.

Anyone with access to this browser profile can open its boards. Data is not encrypted by the app. Separate browser profiles/devices/origins have separate workspaces. A private window, browser cleanup, disk pressure or origin change may remove or hide local boards.

Use Export → Editable backup for portable copies. Trash is recoverable and is not erasure. To erase the entire local workspace, first export anything needed, then clear this website's stored data through your browser settings. This also removes offline assets. Downloaded files must be deleted separately. Browser-level storage protection is discretionary and is not a backup.

This distribution contains no remote privacy-contact endpoint or fabricated operator identity. Before public launch, the owner should publish their own contact details and any policy changes associated with their hosting and support arrangements.
