# Verity Finance design system

## World

The frontend is a dark, tabbed proof manual: an obsidian work surface holds precise mono annotations, while each meaningful state lands on an acetate-colored leaf. The system borrows the physical logic of a reference manual—tabs for navigation, punched markers for state, staged leaves for sequence—without pretending the interface is a paper product.

## Tokens

- **Ground:** `#101113` ink, `#17191c` charcoal, `#1c1f23` board.
- **Paper:** `#e9eae2` for proof folios and readable high-contrast surfaces.
- **Signal:** cyan `#9debe5` / `#4ed3ce` for live proof states and focus.
- **Context:** violet `#a794f8`, blue `#78a9ff`, amber `#edc779`, red `#ff846d`.
- **Type:** DM Sans for interface voice, Space Mono for IDs, labels, measurements, and model data.
- **Depth:** offset soft shadows and restrained layered color fields, never a floating card pile.

## Composition

The first viewport places the proof folio beside the primary action so the product's mechanism is visible before the explanatory content. The four-stage rail remains a persistent orientation device. The demo uses a split desk: private controls on the left, public result leaves on the right. Audit history is a sparse record table rather than a generic metric dashboard.

## Interaction

- Sliders are the primary demo control and always show their bounded 0–100 range.
- Proof stages use the same order as the backend: private input, Poseidon binding, Groth16 verification, chain audit.
- Real success is cyan; mock/unavailable state is amber; failure is red. Every state includes text, not color alone.
- The tamper action is a direct, labeled `+1 score` mutation of the public signal and reports the actual API result.
- Motion is limited to the proof folio orbit, button lift, and stage transition. `prefers-reduced-motion` disables authored movement.

## Responsive behavior

At tablet widths, the folio and narrative stack, then the demo becomes a single-column desk. At mobile widths, navigation collapses to the proof action, the tab rail becomes four compact vertical tabs, the workflow leaves become a single stepped stack, and audit rows hide secondary date columns without horizontal scrolling.
