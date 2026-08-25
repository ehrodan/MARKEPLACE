import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function BrandWordmark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className={`brand-wordmark ${compact ? "brand-wordmark--compact" : ""}`} aria-label={`${BRAND.name} — início`}>
      <span className="brand-wordmark__symbol" aria-hidden="true">
        <Image src={BRAND.assets.posterFront} alt="" fill sizes="48px" priority={href === "/"} />
      </span>
      <span className="brand-wordmark__type">
        <strong>{BRAND.shortName}</strong>
        <span>MARKET</span>
      </span>
    </Link>
  );
}
