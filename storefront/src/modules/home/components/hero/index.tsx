import { Button, Heading } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Hero = () => {
  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative bg-moonlark-cream">
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-6">
        <span className="flex flex-col gap-4">
          <Heading
            level="h1"
            className="font-display text-5xl leading-tight text-moonlark-ink font-normal tracking-tight"
          >
            Moonlark Studio
          </Heading>
          <Heading
            level="h2"
            className="text-xl leading-8 text-moonlark-plum font-normal"
          >
            Handmade crochet, made one stitch at a time.
          </Heading>
        </span>
        <LocalizedClientLink href="/store">
          <Button
            variant="secondary"
            className="border-moonlark-plum text-moonlark-plum"
          >
            Shop the collection
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default Hero
