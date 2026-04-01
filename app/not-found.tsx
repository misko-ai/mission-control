import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] p-8">
      <div className="text-center">
        <p className="text-5xl font-bold text-text-muted mb-4">404</p>
        <h2 className="text-lg font-semibold text-text mb-2">Page not found</h2>
        <p className="text-sm text-text-secondary mb-4">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-hover transition-colors inline-block"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
