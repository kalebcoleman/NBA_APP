interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = "Something went wrong", onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-4">
          Try Again
        </button>
      )}
    </div>
  );
}
