import Image from "next/image";

import type { MediaAsset } from "../domain/model";

interface PublicMediaProps {
  asset: MediaAsset | null;
  className?: string;
  sizes: string;
  preload?: boolean;
}

export function PublicMedia({ asset, className, sizes, preload = false }: PublicMediaProps) {
  if (!asset) {
    return <div className={`${className ?? ""} public-media-fallback`} aria-hidden="true" />;
  }

  return (
    <Image
      className={className}
      src={asset.url}
      alt={asset.altText}
      width={asset.width}
      height={asset.height}
      sizes={sizes}
      quality={80}
      preload={preload}
    />
  );
}

