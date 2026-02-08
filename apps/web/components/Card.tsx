interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export default function Card({ title, children, className = "", headerActions }: CardProps) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {headerActions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
