import PageNavigation from '../components/PageNavigation';
import AgeGroupCards from '../components/AgeGroupCards';

export default function AgeBrowseIndexPage() {
  return (
    <div className="age-browse-page age-browse-page--index">
      <PageNavigation breadcrumbs={[]} />
      <AgeGroupCards asSection={false} />
    </div>
  );
}
