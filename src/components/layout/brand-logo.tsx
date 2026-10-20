export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="milesto-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5A8A F0" />
          <stop stopColor="#5A8AF0" />
          <stop offset="1" stopColor="#3B6FE0" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="8" fill="url(#milesto-grad)" />
      <path
        d="M7.5 19.5V9.5C7.5 9.224 7.724 9 8 9H8.6C8.79 9 8.967 9.107 9.06 9.273L14 18L18.94 9.273C19.033 9.107 19.21 9 19.4 9H20C20.276 9 20.5 9.224 20.5 9.5V19.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20.5" cy="9" r="1.6" fill="white" />
    </svg>
  );
}