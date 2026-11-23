// The Noon logo: black letters and the round face with a smile. SYNAPSE-OWNED (client/brand/**).
// The face colour is the app's own (`--app-face` in client/app/theme.css, read through the
// `--color-face` token); the letters and smile follow the theme so the logo reads in dark mode.
// Paths: noon2-frontend packages/common/src/images/ic_noon_logo_full.svg. The favicon draws the
// same face from scripts/brand-icons.ts; keep the two in step.

const LETTER_N_PATH =
  'M28.4024 0.737549C12.7863 0.737549 0.132812 13.2652 0.132812 28.7261V53.356C0.132812 54.5875 1.15052 55.5951 2.39438 55.5951H7.29066C8.53452 55.5951 9.55223 54.5875 9.55223 53.356V28.7261C9.55223 18.4263 17.9879 10.0633 28.4024 10.0633C38.8056 10.0633 47.2525 18.4151 47.2525 28.7261V53.356C47.2525 54.5875 48.2702 55.5951 49.5141 55.5951H54.4103C55.6542 55.5951 56.6719 54.5875 56.6719 53.356V28.7261C56.6719 13.2652 44.0185 0.737549 28.4024 0.737549Z';
const LETTER_O_PATH =
  'M164.117 0.737549C148.501 0.737549 135.848 13.2652 135.848 28.7261C135.848 44.187 148.501 56.7147 164.117 56.7147C179.733 56.7147 192.387 44.187 192.387 28.7261C192.387 13.2652 179.722 0.737549 164.117 0.737549ZM164.117 47.3889C153.714 47.3889 145.267 39.0371 145.267 28.7261C145.267 18.4151 153.703 10.0633 164.117 10.0633C174.52 10.0633 182.967 18.4151 182.967 28.7261C182.967 39.0371 174.52 47.3889 164.117 47.3889Z';
const LETTER_LAST_N_PATH =
  'M231.965 0.737549C216.349 0.737549 203.695 13.2652 203.695 28.7261V53.356C203.695 54.5875 204.713 55.5951 205.957 55.5951H210.853C212.097 55.5951 213.115 54.5875 213.115 53.356V28.7261C213.115 18.4263 221.55 10.0633 231.965 10.0633C242.368 10.0633 250.815 18.4151 250.815 28.7261V53.356C250.815 54.5875 251.833 55.5951 253.077 55.5951H257.973C259.217 55.5951 260.234 54.5875 260.234 53.356V28.7261C260.234 13.2652 247.581 0.737549 231.965 0.737549Z';
const SMILE_PATH =
  'M96.0642 40.1616C104.661 48.4605 118.8 48.4605 127.396 40.1616C128.753 38.8158 126.491 37.1336 125.36 38.3672C117.895 45.6568 105.792 45.6568 98.2133 38.3672C96.9691 37.1336 94.7069 38.8158 96.0642 40.1616Z';

export interface NoonLogoProps {
  /** `full` = the word "noon"; `mark` = the face only (favicons, small headers). */
  variant?: 'full' | 'mark';
  /** Size with text-size or h-* classes; the logo scales with its height. */
  className?: string;
  /** Accessible name. Defaults to "noon". */
  title?: string;
}

export function NoonLogo({ variant = 'full', className, title = 'noon' }: NoonLogoProps) {
  const viewBox = variant === 'full' ? '0 0 261 57' : '66.5 -3.3 64 64';
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="96.2618" cy="28.7261" r="27.9886" className="fill-face" />
      <path d={SMILE_PATH} className="fill-logo-smile" />
      {variant === 'full' && (
        <g className="fill-logo-ink">
          <path d={LETTER_N_PATH} />
          <path d={LETTER_O_PATH} />
          <path d={LETTER_LAST_N_PATH} />
        </g>
      )}
    </svg>
  );
}
