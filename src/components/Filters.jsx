export function Filters({ children, className = '' }) {
  return <div className={`react-filters ${className}`.trim()}>{children}</div>;
}
