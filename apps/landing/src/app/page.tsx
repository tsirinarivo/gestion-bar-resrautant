import { Hero } from '@/components/sections/Hero'
import { LogosTrust } from '@/components/sections/LogosTrust'
import { Features } from '@/components/sections/Features'
import { ScreenshotsShowcase } from '@/components/sections/ScreenshotsShowcase'
import { Stats } from '@/components/sections/Stats'
import { Pricing } from '@/components/sections/Pricing'
import { Testimonials } from '@/components/sections/Testimonials'
import { Faq } from '@/components/sections/Faq'
import { Cta } from '@/components/sections/Cta'

export default function HomePage() {
  return (
    <>
      <Hero />
      <LogosTrust />
      <Features />
      <ScreenshotsShowcase />
      <Stats />
      <Pricing />
      <Testimonials />
      <Faq />
      <Cta />
    </>
  )
}
