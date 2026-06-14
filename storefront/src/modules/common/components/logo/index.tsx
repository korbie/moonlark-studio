import { clx } from "@medusajs/ui"

type LogoProps = {
  className?: string
  textClassName?: string
}

/**
 * Moonlark Studio wordmark: a crescent-moon mark + the studio name in the
 * brand display font.
 */
const Logo = ({ className, textClassName }: LogoProps) => {
  return (
    <span className={clx("flex items-center gap-x-2", className)}>
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-moonlark-plum"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        <path d="M18 4.5l.6 1.4 1.4.6-1.4.6L18 8.5l-.6-1.4-1.4-.6 1.4-.6z" />
      </svg>
      <span
        className={clx(
          "font-display text-lg leading-none text-moonlark-plum tracking-tight",
          textClassName
        )}
      >
        Moonlark Studio
      </span>
    </span>
  )
}

export default Logo
