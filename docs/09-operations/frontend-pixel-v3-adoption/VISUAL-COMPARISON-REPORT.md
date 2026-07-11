# Visual comparison report

## Current status

Selected source artwork has been extracted into `apps/web/public/art/yuzan-v3` and placed behind the reusable `V3TerrainArtwork` component. It is used on login, student today, and assessment entry while preserving semantic DOM content and existing state/gateway boundaries.

The source design contributes mountain ridges, contour texture, valley/path composition, highland red, barley green, snow white, and path gold. Composite mobile screenshots and static AI/report imagery are excluded.

## Comparison rounds

Round 1 source captures were attempted with Chrome Headless. The temporary server lifecycle failed midway, so connection-refused screenshots are explicitly invalid. Round 2 and authoritative official-before/after captures were not completed. MAE and perceptual metrics were not calculated because incomplete captures would produce misleading values.

## Known differences

- Official pages keep fluid Grid/Flex layouts instead of the source fixed canvas.
- Production typography and text remain DOM content.
- Source static recording/report success states are replaced by existing unavailable/pending/demo boundaries.
- Artwork is cropped responsively and is decorative where it carries no unique information.
- Login artwork collapses above the form on mobile; it does not shrink the desktop canvas.

This report is intentionally incomplete until a stable browser harness can complete both screenshot rounds.

