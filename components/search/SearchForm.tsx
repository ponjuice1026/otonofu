type SearchFormProps = {
  initialQuery?: string;
};

export function SearchForm({ initialQuery = "" }: SearchFormProps) {
  return (
    <form action="/search" method="get" className="mb-10 max-w-2xl">
      <label htmlFor="search-page-query" className="sr-only">
        キーワードで検索
      </label>
      <div className="search-field">
        <svg
          aria-hidden
          className="search-field__icon h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 16l4 4" />
        </svg>
        <input
          id="search-page-query"
          name="q"
          type="search"
          defaultValue={initialQuery}
          placeholder="キーワードで検索"
          className="search-field__input"
          autoComplete="off"
        />
      </div>
      <button type="submit" className="btn-primary mt-3">
        検索する
      </button>
    </form>
  );
}
