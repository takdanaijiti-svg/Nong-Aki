interface AkiLogoProps {
  className?: string;
}

export function AkiLogo({ className = 'w-10 h-10' }: AkiLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="โลโก้น้อนอากิ้"
      className={className}
    >
      <circle cx="32" cy="32" r="30" fill="#FAF7F2" stroke="#EAE0D5" strokeWidth="2" />
      <path
        d="M16 56C17.5 46.5 24 42 32 42C40 42 46.5 46.5 48 56"
        fill="#C8A27C"
        stroke="#5C4033"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 30C19 19 24.5 13 32 13C39.5 13 45 19 45 30V37C45 39 43.5 40 42 40H22C20.5 40 19 39 19 37V30Z"
        fill="#5C4033"
      />
      <circle cx="32" cy="29" r="10.5" fill="#FCE7D9" stroke="#5C4033" strokeWidth="2" />
      <path
        d="M21.5 27C23.5 21 28 19 32 19C36 19 40.5 21 42.5 27C39 24 35.5 23 32 23.5C28.5 23 25 24 21.5 27Z"
        fill="#5C4033"
      />
      <rect
        x="37"
        y="21.5"
        width="4.5"
        height="2"
        rx="1"
        transform="rotate(20 37 21.5)"
        fill="#E6B89C"
      />
      <path
        d="M26.5 29.5C27.2 28.2 28.8 28.2 29.5 29.5"
        stroke="#5C4033"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M34.5 29.5C35.2 28.2 36.8 28.2 37.5 29.5"
        stroke="#5C4033"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="25.5" cy="32" r="1.7" fill="#E8A598" opacity="0.75" />
      <circle cx="38.5" cy="32" r="1.7" fill="#E8A598" opacity="0.75" />
      <path
        d="M30 33C31 34.4 33 34.4 34 33"
        stroke="#5C4033"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M25.5 44H38.5L37.3 54.5C37.1 55.6 36.1 56.5 35 56.5H29C27.9 56.5 26.9 55.6 26.7 54.5L25.5 44Z"
        fill="#FFFFFF"
        stroke="#5C4033"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M38.3 46.5H40.3C41.5 46.5 42.3 47.4 42.3 48.5C42.3 49.7 41.5 50.6 40.3 50.6H38"
        stroke="#5C4033"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M32 51.8C32 51.8 29.8 50.3 29.8 48.9C29.8 48.1 30.4 47.6 31.1 47.6C31.5 47.6 31.8 47.8 32 48.1C32.2 47.8 32.5 47.6 32.9 47.6C33.6 47.6 34.2 48.1 34.2 48.9C34.2 50.3 32 51.8 32 51.8Z"
        fill="#C8A27C"
      />
      <path
        d="M29.5 41.2C29.1 40.1 29.9 39.2 29.6 38.2"
        stroke="#C8A27C"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M34.5 41.2C34.1 40.1 34.9 39.2 34.6 38.2"
        stroke="#C8A27C"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
