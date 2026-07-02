import Image from "next/image";

export function SiteBackdrop() {
  return (
    <div className="site-backdrop" aria-hidden>
      <div className="site-backdrop__orb site-backdrop__orb--amber" />
      <div className="site-backdrop__orb site-backdrop__orb--violet" />
      <div className="site-backdrop__orb site-backdrop__orb--rose" />
      <Image
        src="/brand/otonofu-icon.png?v=3"
        alt=""
        width={220}
        height={220}
        unoptimized
        className="site-backdrop__mark site-backdrop__mark--left"
      />
      <Image
        src="/brand/otonofu-icon.png?v=3"
        alt=""
        width={180}
        height={180}
        unoptimized
        className="site-backdrop__mark site-backdrop__mark--right"
      />
      <Image
        src="/brand/otonofu-icon.png?v=3"
        alt=""
        width={320}
        height={320}
        unoptimized
        className="site-backdrop__mark site-backdrop__mark--center"
      />
    </div>
  );
}
