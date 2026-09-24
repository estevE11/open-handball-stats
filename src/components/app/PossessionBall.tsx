/** Decorative, panelled handball. The surrounding scoreboard clips the artwork. */
export function PossessionBall() {
  return (
    <div className="possession-ball-clip" aria-hidden="true">
      <div className="possession-ball-track">
        <svg
          className="possession-ball"
          viewBox="0 0 100 100"
          fill="none"
          focusable="false"
        >
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="currentColor"
            fillOpacity=".12"
            stroke="currentColor"
            strokeWidth="2"
          />
          <g
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <path
              d="M50 28 70 42 62 65H38L30 42Z"
              fill="currentColor"
              fillOpacity=".55"
            />
            <path d="M50 28V13M70 42 85 37M62 65 71 79M38 65 29 79M30 42 15 37" />
            <path d="M36 5 50 13 64 5M88 22 85 37 97 48M86 80 71 79 65 95M35 95 29 79 14 80M3 48 15 37 12 22" />
            <path
              d="M36 5 12 22M64 5 88 22M97 48 86 80M65 95H35M14 80 3 48"
              strokeOpacity=".45"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
