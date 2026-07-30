/**
 * Every tunable number in Hexer. Nothing else in the codebase may inline
 * a threshold. Starting values tuned against tests/fixtures.
 */

/**
 * OKLCH chroma floor for a color to qualify as BRAND.
 *
 * Measured against real palettes. Brand colors cluster at 0.104 to 0.306
 * (#040038 AZMX navy 0.104, #5E6AD2 Linear 0.159, #635BFF Stripe 0.235,
 * #F83200 0.236, #001AFF 0.306). Neutrals sit at 0.000 to 0.037 (white, greys,
 * #E3E8EE 0.010, #425466 0.037). #0A2540 Stripe navy is the only borderline
 * case at 0.060, and it reads as a dark surface, so 0.08 puts it there.
 *
 * There is deliberately NO area cap. An earlier draft required a brand color
 * to cover under 20% of the page, on the theory that accents are used
 * sparingly. The hero fixture disproved it: a full-bleed orange hero is the
 * brand color, not a surface. Area decides ordering within a group, never
 * membership of it.
 */
export const CHROMA_BRAND_MIN = 0.08;

/**
 * OKLab distance below which two colors merge.
 *
 * Measured against real pairs. One-step hex differences — the rounding noise
 * we want gone — sit at 0.0014 to 0.004. Meaningfully distinct colors start
 * around 0.013: #111111 vs #141414 is 0.0136, and #FFFFFF vs #F6F9FC is
 * 0.0199. The spec's initial 0.02 fused that last pair, which is a visible
 * error in a tool that promises exact values. 0.005 sits ~3x clear of both
 * sides of the gap.
 */
export const CLUSTER_DELTA_E = 0.005;

/** Elements scanned before sampling kicks in. */
export const ELEMENT_CAP = 20000;

/** Colors below this alpha are discarded. */
export const ALPHA_MIN = 0.05;

/** Longest edge, in pixels, of the downsampled screenshot. */
export const PIXEL_SAMPLE_MAX = 200;

/** Number of colors the quantiser returns. */
export const PIXEL_COLOR_COUNT = 8;
