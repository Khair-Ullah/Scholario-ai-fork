type BrandWordmarkProps = {
  className?: string;
  hideLeadingS?: boolean;
};

export default function BrandWordmark({ className = "", hideLeadingS = false }: BrandWordmarkProps) {
  return (
    <span className={`brand-wordmark ${className}`.trim()} aria-hidden="true">
      <span className="brand-wordmark-primary">{hideLeadingS ? "chol" : "schol"}</span>
      <span className="brand-wordmark-secondary">ario</span>
      <span className="brand-wordmark-dot">.</span>
    </span>
  );
}
