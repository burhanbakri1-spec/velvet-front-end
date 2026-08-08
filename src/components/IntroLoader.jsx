export default function IntroLoader({ active }) {
  return active ? (
    <div className="intro-loader" aria-hidden="true">
      <span className="intro-loader__mark" />
    </div>
  ) : null;
}
