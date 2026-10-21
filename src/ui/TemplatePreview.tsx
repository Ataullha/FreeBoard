import { useId } from 'react';
import type { TemplateId } from '../editor/templates';

/** Small, local illustrations of the editable templates. No external assets. */
export function TemplatePreview({ kind }: { kind: TemplateId | 'welcome' }) {
  const grid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 240 120" fill="none" aria-hidden="true">
      <defs>
        <pattern id={grid} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="0.7" fill="#e1e1e1" />
        </pattern>
      </defs>
      <path fill={`url(#${grid})`} d="M0 0h240v120H0z" />
      {kind === 'blank' ? (
        <>
          <rect
            x="93"
            y="32"
            width="54"
            height="56"
            rx="10"
            fill="white"
            stroke="#e1e1e1"
          />
          <path
            d="M120 48v24m-12-12h24"
            stroke="#606060"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : kind === 'lesson' ? (
        <>
          <rect x="43" y="24" width="154" height="16" rx="4" fill="#e9e9e9" />
          <rect
            x="43"
            y="48"
            width="70"
            height="51"
            rx="5"
            fill="white"
            stroke="#e1e1e1"
          />
          <rect x="121" y="48" width="76" height="22" rx="5" fill="#ededed" />
          <rect x="121" y="78" width="76" height="21" rx="5" fill="#e7e7e7" />
          <path
            d="M54 59h39m-39 8h48m-48 8h33m-33 8h42"
            stroke="#a6a6a6"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M54 32h70"
            stroke="#7d7d7d"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : kind === 'flowchart' ? (
        <>
          <path d="M87 60h66M120 38v44" stroke="#a7a7a7" strokeWidth="1.5" />
          <path
            d="m148 56 5 4-5 4m-32 13 4 5 4-5"
            stroke="#a7a7a7"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <rect
            x="94"
            y="13"
            width="52"
            height="25"
            rx="6"
            fill="#e9e9e9"
            stroke="#cccccc"
          />
          <rect
            x="35"
            y="46"
            width="52"
            height="28"
            rx="6"
            fill="white"
            stroke="#d4d4d4"
          />
          <rect
            x="153"
            y="46"
            width="52"
            height="28"
            rx="6"
            fill="#e7e7e7"
            stroke="#cfcfcf"
          />
          <rect
            x="94"
            y="82"
            width="52"
            height="25"
            rx="6"
            fill="#ededed"
            stroke="#dadada"
          />
          <path
            d="M105 25h30M47 60h28m92 0h24m-86 34h30"
            stroke="#8e8e8e"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M78 52c24-28 48-28 76 0m-76 16c26 27 56 26 78-2"
            stroke="#bababa"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <g transform="rotate(-9 73 54)">
            <rect
              x="44"
              y="22"
              width="58"
              height="62"
              rx="5"
              fill="#e4e4e4"
              stroke="#d0d0d0"
            />
            <path
              d="M55 40h34M55 48h27M55 56h32"
              stroke="#9c9c9c"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
          <g transform="rotate(7 156 68)">
            <rect
              x="126"
              y="37"
              width="61"
              height="62"
              rx="5"
              fill="#e1e1e1"
              stroke="#cacaca"
            />
            <path
              d="M138 54h33m-33 8h25m-25 8h30"
              stroke="#939393"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
          <circle cx="113" cy="23" r="10" fill="white" stroke="#d2d2d2" />
          <path
            d="m109 23 3 3 5-6"
            stroke="#707070"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {kind === 'welcome' && (
            <path d="m204 23 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" fill="#959595" />
          )}
        </>
      )}
    </svg>
  );
}
