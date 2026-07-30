/**
 * Every tunable number in Hexer. Nothing else in the codebase may inline
 * a threshold. Starting values tuned against tests/fixtures.
 */

/** OKLCH chroma floor for a colour to qualify as BRAND. */
export const CHROMA_BRAND_MIN = 0.06;

/** Above this share of painted area, a saturated colour is a SURFACE not a BRAND. */
export const BRAND_AREA_MAX_PCT = 20;

/** OKLab distance below which two colours merge. */
export const CLUSTER_DELTA_E = 0.02;

/** Elements scanned before sampling kicks in. */
export const ELEMENT_CAP = 20000;

/** Colours below this alpha are discarded. */
export const ALPHA_MIN = 0.05;

/** Longest edge, in pixels, of the downsampled screenshot. */
export const PIXEL_SAMPLE_MAX = 200;

/** Number of colours the quantiser returns. */
export const PIXEL_COLOR_COUNT = 8;
