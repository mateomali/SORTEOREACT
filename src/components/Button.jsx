export function Button({ children, className = '', type = 'button', isLoading = false, ...props }) {
  return (
    <button
      type={type}
      className={`btn ${className}`.trim()}
      disabled={isLoading || props.disabled}
      aria-busy={isLoading ? 'true' : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
