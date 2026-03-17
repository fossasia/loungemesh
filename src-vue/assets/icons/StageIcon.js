import React from "react";

function Icon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      version="1.1"
      viewBox="0 0 24 24"
      style={{ WebkitPrintColorAdjust: "exact", fill:"none" }}
    >
      <g>
        <g>
          <ellipse
            cx="12"
            cy="13"
            strokeWidth="2"
            rx="2"
            ry="2"
          ></ellipse>
          <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M4.27 20.95A10.967 10.967 0 011 13.125c0-6.07 4.929-11 11-11s11 4.93 11 11c0 3.012-1.213 5.743-3.177 7.73"
          ></path>
          <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M6.356 16.547A6.603 6.603 0 0112 6.526a6.603 6.603 0 015.685 9.953"
          ></path>
        </g>
      </g>
    </svg>
  );
}

export default Icon;
