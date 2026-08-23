import CompanyCareersCta from '../components/CompanyCareersCta';
import EditorialSplit from '../components/EditorialSplit';
import PageVideoHero from '../components/PageVideoHero';
import { aboutSections } from '../data/company';
import { getPlatformMedia } from '../data/platformContent';
import { useI18n } from '../i18n/I18nContext';

export default function AboutPage() {
  const { copy } = useI18n();
  return (
    <div className="about-page">
      <PageVideoHero title={copy.about.title} eyebrow={copy.about.eyebrow} video={getPlatformMedia('about.hero.video', '/media/play-feature.mp4')} poster={getPlatformMedia('about.hero.poster', '/media/poster-about.jpg')} theme="about" overlay={0.38} />
      <div className="editorial-sections">
        {aboutSections.map((section) => <EditorialSplit section={section} key={section.title} />)}
      </div>
      <CompanyCareersCta />
    </div>
  );
}
