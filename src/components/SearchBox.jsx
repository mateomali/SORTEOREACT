export function SearchBox({ value, onChange, placeholder = 'Buscar...', id }) {
  return (
    <div className="react-search-box" role="search">
      <span aria-hidden="true">Buscar</span>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
