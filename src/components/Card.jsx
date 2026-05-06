export function Card({ children, className = '', as: Element = 'section', ...props }) {
  return (
    <Element className={`card ${className}`.trim()} {...props}>
      {children}
    </Element>
  );
}
