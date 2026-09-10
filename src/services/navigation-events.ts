type SearchFocusListener = () => void;
type SearchQueryListener = (query: string) => void;
type LibraryRefreshListener = () => void;

const searchFocusListeners = new Set<SearchFocusListener>();
const searchQueryListeners = new Set<SearchQueryListener>();
const libraryRefreshListeners = new Set<LibraryRefreshListener>();
let pendingSearchQuery = '';
let libraryRefreshScheduled = false;

export function requestSearchFocus() {
  searchFocusListeners.forEach((listener) => listener());
}

export function subscribeToSearchFocus(listener: SearchFocusListener) {
  searchFocusListeners.add(listener);
  return () => {
    searchFocusListeners.delete(listener);
  };
}

export function requestSearchQuery(query: string) {
  pendingSearchQuery = query;
  searchQueryListeners.forEach((listener) => listener(query));
}

export function subscribeToSearchQuery(listener: SearchQueryListener) {
  searchQueryListeners.add(listener);
  if (pendingSearchQuery) {
    listener(pendingSearchQuery);
    pendingSearchQuery = '';
  }
  return () => {
    searchQueryListeners.delete(listener);
  };
}

export function requestLibraryRefresh() {
  if (libraryRefreshScheduled) return;
  libraryRefreshScheduled = true;
  queueMicrotask(() => {
    libraryRefreshScheduled = false;
    libraryRefreshListeners.forEach((listener) => listener());
  });
}

export function subscribeToLibraryRefresh(listener: LibraryRefreshListener) {
  libraryRefreshListeners.add(listener);
  return () => {
    libraryRefreshListeners.delete(listener);
  };
}
