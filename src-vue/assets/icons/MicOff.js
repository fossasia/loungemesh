// used https://svg2jsx.com/ - thx a lot <3

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
      <g clipPath="url(#frame-clip-a6a78f70-94c5-11ec-a547-e7091bb4fd45-ed375f60-94c5-11ec-9f1c-11b5e9139405)">
        <defs>
          <clipPath
            id="frame-clip-a6a78f70-94c5-11ec-a547-e7091bb4fd45-ed375f60-94c5-11ec-9f1c-11b5e9139405"
            className="frame-clip"
          >
            <path d="M0 0H24V24H0z"></path>
          </clipPath>
        </defs>
        <g opacity="1">
          <g className="feather feather-mic-off">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M1 1l22 21.985"
            ></path>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8.532 10.82V14.2a3.382 3.382 0 005.771 2.39m.992-5.388v-6.02a3.382 3.382 0 00-6.696-.676"
            ></path>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17.55 19.78a7.89 7.89 0 01-13.527-5.579v-2.254m15.78 0V14.2c0 .465-.041.929-.123 1.386"
            ></path>
          </g>
        </g>
      </g>
    </svg>
  );
}

export default Icon;
