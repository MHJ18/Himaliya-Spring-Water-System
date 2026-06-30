import React from 'react';

function SearchIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.25" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M15.2 15.2L20 20"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="10.5" cy="10.5" r="2.2" fill="currentColor" opacity="0.28" />
    </svg>
  );
}

export default SearchIcon;
