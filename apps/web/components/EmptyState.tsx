interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ title = "No results", message = "Try adjusting your search or filters.", action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
      <p className="text-lg font-medium text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
