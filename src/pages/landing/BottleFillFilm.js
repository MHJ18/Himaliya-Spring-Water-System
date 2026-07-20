import React from 'react';

function JugFilm() {
  return (
    <svg
      className="bottle-film__svg"
      viewBox="0 0 520 680"
      role="img"
      aria-label="A nineteen litre water jug filling with moving water"
    >
      <defs>
        <linearGradient id="jug-glass" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".5" />
          <stop offset=".28" stopColor="#d8f7ff" stopOpacity=".14" />
          <stop offset=".72" stopColor="#58cce9" stopOpacity=".08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity=".28" />
        </linearGradient>
        <linearGradient id="jug-water" x1=".12" x2=".88" y1="0" y2="1">
          <stop offset="0" stopColor="#b9f4ff" />
          <stop offset=".42" stopColor="#26c6e7" />
          <stop offset="1" stopColor="#047da6" />
        </linearGradient>
        <linearGradient id="jug-stream" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#e6fbff" stopOpacity=".3" />
          <stop offset=".35" stopColor="#8feaff" stopOpacity=".96" />
          <stop offset="1" stopColor="#1db8da" stopOpacity=".74" />
        </linearGradient>
        <radialGradient id="jug-caustic">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".72" />
          <stop offset="1" stopColor="#b6f5ff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="jug-clip">
          <path d="M207 106h106v40c0 17 11 28 34 41 49 28 73 67 73 119v232c0 57-39 94-96 94H196c-57 0-96-37-96-94V306c0-52 24-91 73-119 23-13 34-24 34-41Z" />
        </clipPath>
        <filter id="jug-stream-blur" x="-80%" y="-20%" width="260%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <g className="bottle-film__stage-lines" aria-hidden="true">
        <path d="M34 632H486" />
        <path d="M52 94V632M468 94V632" />
        <path d="M34 210H80M440 210H486M34 420H80M440 420H486" />
      </g>

      <g className="bottle-film__stream" aria-hidden="true">
        <path
          d="M260 -18C255 62 267 113 258 184C252 231 266 254 260 307"
          stroke="url(#jug-stream)"
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M260 -18C255 62 267 113 258 184C252 231 266 254 260 307"
          stroke="#d9fbff"
          strokeWidth="24"
          strokeLinecap="round"
          fill="none"
          opacity=".22"
          filter="url(#jug-stream-blur)"
        />
      </g>

      <g className="bottle-film__cap" aria-hidden="true">
        <rect x="212" y="76" width="96" height="37" rx="11" fill="#173747" />
        <path d="M226 83V106M240 83V106M254 83V106M268 83V106M282 83V106M296 83V106" stroke="#4e788a" strokeWidth="3" />
      </g>

      <path
        className="bottle-film__glass"
        d="M207 106h106v40c0 17 11 28 34 41 49 28 73 67 73 119v232c0 57-39 94-96 94H196c-57 0-96-37-96-94V306c0-52 24-91 73-119 23-13 34-24 34-41Z"
        fill="url(#jug-glass)"
        stroke="rgba(220,249,255,.9)"
        strokeWidth="4"
      />

      <g clipPath="url(#jug-clip)">
        <g className="bottle-film__liquid">
          <rect x="78" y="245" width="364" height="410" fill="url(#jug-water)" />
          <path
            className="bottle-film__wave bottle-film__wave--rear"
            d="M60 257C105 234 145 278 190 253S276 238 322 257s88 16 138-7v42H60Z"
            fill="#86e9f7"
            opacity=".72"
          />
          <path
            className="bottle-film__wave bottle-film__wave--front"
            d="M47 265C98 285 133 238 185 263s91 26 141 0 91-8 151 4v46H47Z"
            fill="#c8f9ff"
            opacity=".68"
          />
          <ellipse className="bottle-film__caustic bottle-film__caustic--one" cx="166" cy="395" rx="82" ry="38" fill="url(#jug-caustic)" />
          <ellipse className="bottle-film__caustic bottle-film__caustic--two" cx="350" cy="502" rx="66" ry="32" fill="url(#jug-caustic)" />
          <g className="bottle-film__bubbles" fill="none" stroke="#dffcff">
            <circle className="bottle-film__bubble bottle-film__bubble--one" cx="166" cy="550" r="8" />
            <circle className="bottle-film__bubble bottle-film__bubble--two" cx="324" cy="588" r="5" />
            <circle className="bottle-film__bubble bottle-film__bubble--three" cx="285" cy="520" r="11" />
            <circle className="bottle-film__bubble bottle-film__bubble--four" cx="208" cy="610" r="4" />
          </g>
        </g>
      </g>

      <path
        className="bottle-film__handle"
        d="M329 205c52 14 62 54 58 97-5 48-25 77-64 82-24 3-39-11-41-34l-5-63c-2-36 15-65 52-82Zm7 46c-18 5-26 19-25 40l3 40c1 9 7 14 16 12 14-3 21-20 23-45 2-24-3-42-17-47Z"
        fill="rgba(221,249,255,.18)"
        stroke="rgba(220,249,255,.76)"
        strokeWidth="3"
      />
      <path className="bottle-film__highlight" d="M164 217c-27 30-40 65-40 113v161" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity=".48" />
      <path className="bottle-film__glint" d="m154 214 9-23 9 23 23 9-23 9-9 23-9-23-23-9Z" fill="#fff" />

      <g className="bottle-film__label">
        <rect x="153" y="395" width="214" height="110" rx="18" fill="rgba(246,253,253,.92)" stroke="rgba(9,100,126,.18)" />
        <path d="M153 425H367" stroke="#10a5c5" strokeWidth="3" />
        <text x="181" y="460" fill="#123746" fontSize="33" fontWeight="800" letterSpacing="5">HIMALIYA</text>
        <text x="181" y="486" fill="#27768e" fontSize="14" fontWeight="700" letterSpacing="4">SPRING WATER · 19L</text>
      </g>
    </svg>
  );
}

function BottleFillFilm({ playing = true, replayKey = 0 }) {
  return (
    <div
      key={`refill-${replayKey}`}
      className={`bottle-film bottle-film--refill${playing ? ' is-playing' : ''}`}
      data-film-mode="refill"
    >
      <span className="bottle-film__timecode" aria-hidden="true">00:04:20</span>
      <span className="bottle-film__status" aria-hidden="true"><i /> Filling sequence</span>
      <JugFilm />
      <div className="bottle-film__timeline" aria-hidden="true">
        <i />
        <span>Fill</span>
        <span>Settle</span>
        <span>Ready</span>
      </div>
    </div>
  );
}

export default BottleFillFilm;
