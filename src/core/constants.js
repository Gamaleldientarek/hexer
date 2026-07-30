/**
 * Every tunable number in Hexer. Nothing else in the codebase may inline
 * a threshold. Starting values tuned against tests/fixtures.
 */

/** OKLCH chroma floor for a colour to qualify as BRAND. */
export const CHROMA_BRAND_MIN = 0.06;

/** Above this share of painted area, a saturated colour is a SURFACE not a BRAND. */
export const BRAND_AREA_MAX_PCT = 20;

/**
 * OKLab distance below which two colours merge.
 *
 * Measured against real pairs. One-step hex differences — the rounding noise
 * we want gone — sit at 0.0014 to 0.004. Meaningfully distinct colours start
 * around 0.013: #111111 vs #141414 is 0.0136, and #FFFFFF vs #F6F9FC is
 * 0.0199. The spec's initial 0.02 fused that last pair, which is a visible
 * error in a tool that promises exact values. 0.005 sits ~3x clear of both
 * sides of the gap.
 */
export const CLUSTER_DELTA_E = 0.005;

/** Elements scanned before sampling kicks in. */
export const ELEMENT_CAP = 20000;

/** Colours below this alpha are discarded. */
export const ALPHA_MIN = 0.05;

/** Longest edge, in pixels, of the downsampled screenshot. */
export const PIXEL_SAMPLE_MAX = 200;

/** Number of colours the quantiser returns. */
export const PIXEL_COLOR_COUNT = 8;
