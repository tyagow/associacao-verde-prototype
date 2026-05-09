import Link from "next/link";

export default function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Apoiar Brasil">
      <img
        className="brand-logo"
        src="/brand/logo-apoiar-preto.png"
        alt=""
        width="192"
        height="68"
      />
    </Link>
  );
}
