type SearchFocusListener = () => void;
type SearchQueryListener = (query: string) => void;
type LibraryRefreshListener = () => void;
type PlayerCollapseListener = () => void;

const searchFocusListeners = new Set<SearchFocusListener>();
const searchQueryListeners = new Set<SearchQueryListener>();
const libraryRefreshListeners = new Set<LibraryRefreshListener>();
const playerCollapseListeners = new Set<PlayerCollapseListener>();
let searchQuery = '';
let libraryRefreshScheduled = false;

/** Root sheets sit outside the tab overlay's context, but can reveal its detail pages. */
export function requestPlayerCollapse() {
  playerCollapseListeners.forEach((listener) => listener());
}

export function subscribeToPlayerCollapse(listener: PlayerCollapseListener) {
  playerCollapseListeners.add(listener);
  return () => {
    playerCollapseListeners.delete(listener);
  };
}

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
  searchQuery = query;
  searchQueryListeners.forEach((listener) => listener(query));
}

export function getSearchQuery() {
  return searchQuery;
}

export function subscribeToSearchQuery(listener: SearchQueryListener) {
  searchQueryListeners.add(listener);
  // Both the persistent toolbar and the route need the latest value, including a clear.
  listener(searchQuery);
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
