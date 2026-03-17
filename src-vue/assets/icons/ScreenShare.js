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
      <g clipPath="url(#frame-clip-f2dce100-94c6-11ec-a547-e7091bb4fd45-e9940f00-94c7-11ec-920a-d5869ee7c53a)">
        <defs>
          <clipPath
            id="frame-clip-f2dce100-94c6-11ec-a547-e7091bb4fd45-e9940f00-94c7-11ec-920a-d5869ee7c53a"
            className="frame-clip"
          >
            <path d="M0 0H24V24H0z"></path>
          </clipPath>
        </defs>
        <g>
          <rect
            width="20"
            height="12"
            x="2"
            y="6"
            strokeWidth="2"
            rx="2"
            ry="2"
          ></rect>
          <path
            strokeWidth="2"
            d="M12 18v-7"
          ></path>
          <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M9 14l3-3 3 3"
          ></path>
        </g>
      </g>
    </svg>
  );
}

export default Icon;
