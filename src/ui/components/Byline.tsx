/** The maker's quiet signature. The app's own name stays the hero. */
export const COMPANY_URL = 'https://haveanapp.com';

export function Byline() {
  return (
    <p className="byline" data-haveanapp="">
      <a className="byline-link" href={COMPANY_URL} target="_blank" rel="noopener">
        by HaveAnApp
      </a>
    </p>
  );
}
