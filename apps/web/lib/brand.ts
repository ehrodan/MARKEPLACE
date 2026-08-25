const configuredName = process.env.NEXT_PUBLIC_BRAND_NAME?.trim();

export const BRAND = Object.freeze({
  name: configuredName || "OCHPOCH MARKET",
  shortName: (configuredName || "OCHPOCH MARKET").replace(/\s+MARKET$/i, ""),
  tagline: "VALOR QUE CONVERGE.",
  colors: Object.freeze({
    obsidian: "#080908",
    antiqueGold: "#C8922F",
    parchment: "#EEE5D4",
    verdigris: "#526B55",
    danger: "#C7554D",
  }),
  assets: Object.freeze({
    model: "/assets/brand/ochpoch-market.glb",
    vaultHero: "/assets/brand/ochpoch-market-vault-hero-v2.png",
    posterAngle: "/assets/brand/ochpoch-market-angle.png",
    posterFront: "/assets/brand/ochpoch-market-front.png",
  }),
});
