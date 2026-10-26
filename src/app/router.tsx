import {
  Children,
  createContext,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * The PWA's router (WEB-001 budget: react-router was 14 KB of a 5 s Slow 3G budget). Only what
 * the screens use, with react-router's names: path patterns with `:params` and a `*` fallback,
 * Link, Navigate and the location hooks. Browser history in the app, memory in tests.
 */
export interface Location {
  pathname: string;
  search: string;
}

interface NavigateOptions {
  replace?: boolean;
}

export type NavigateFn = (to: string | number, opts?: NavigateOptions) => void;

interface RouterValue {
  location: Location;
  navigate: NavigateFn;
}

const RouterContext = createContext<RouterValue | null>(null);
const ParamsContext = createContext<Record<string, string>>({});

function split(to: string): Location {
  const u = new URL(to, 'http://x');
  return { pathname: u.pathname, search: u.search };
}

/** The browser's address bar: push, replace, back. */
export function BrowserRouter({ children }: { children: ReactNode }) {
  const read = () => ({ pathname: window.location.pathname, search: window.location.search });
  const [location, setLocation] = useState<Location>(read);

  useEffect(() => {
    const onPop = () => setLocation(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback<NavigateFn>((to, opts) => {
    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }
    const next = split(to);
    const url = next.pathname + next.search;
    if (opts?.replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    setLocation(next);
    if (!opts?.replace) window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

/** Tests: history in memory, starting at the last of `initialEntries`. */
export function MemoryRouter({
  initialEntries = ['/'],
  children,
}: {
  initialEntries?: string[];
  children: ReactNode;
}) {
  const [stack, setStack] = useState<Location[]>(() => initialEntries.map(split));
  const location = stack[stack.length - 1]!;
  const navigate = useCallback<NavigateFn>((to, opts) => {
    setStack((s) => {
      if (typeof to === 'number')
        return to < 0 && s.length > 1 ? s.slice(0, Math.max(1, s.length + to)) : s;
      const next = split(to);
      return opts?.replace ? [...s.slice(0, -1), next] : [...s, next];
    });
  }, []);
  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter(): RouterValue {
  const r = useContext(RouterContext);
  if (!r) throw new Error('Router hooks need a BrowserRouter or MemoryRouter');
  return r;
}

export function useLocation(): Location {
  return useRouter().location;
}

export function useNavigate(): NavigateFn {
  return useRouter().navigate;
}

export function useParams(): Record<string, string | undefined> {
  return useContext(ParamsContext);
}

export function useSearchParams(): [URLSearchParams] {
  const { search } = useLocation();
  return [useMemo(() => new URLSearchParams(search), [search])];
}

/** `/shops/:accountId/pay` against a path: the params, or null. `*` matches anything. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  if (pattern === '*') return {};
  const want = pattern.split('/').filter(Boolean);
  const got = pathname.split('/').filter(Boolean);
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    const w = want[i]!;
    const g = got[i]!;
    if (w.startsWith(':')) params[w.slice(1)] = decodeURIComponent(g);
    else if (w !== g) return null;
  }
  return params;
}

export function Route(_props: { path: string; element: ReactElement }): null {
  // Read by <Routes>; never rendered on its own.
  return null;
}

/** The first route whose pattern matches (patterns are distinct; `*` last as the fallback). */
export function Routes({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const routes = Children.toArray(children).filter(isValidElement) as ReactElement<{
    path: string;
    element: ReactElement;
  }>[];
  const ordered = [
    ...routes.filter((r) => r.props.path !== '*'),
    ...routes.filter((r) => r.props.path === '*'),
  ];
  for (const r of ordered) {
    const params = matchPath(r.props.path, pathname);
    if (params)
      return <ParamsContext.Provider value={params}>{r.props.element}</ParamsContext.Provider>;
  }
  return null;
}

/** Goes to `to` once rendered (redirects in gates and screens). */
export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
}

/** An in-app link: a real `<a href>` (long-press, open in new tab) that navigates in place. */
export function Link({
  to,
  className,
  style,
  onClick,
  children,
}: {
  to: string;
  className?: string;
  style?: Record<string, string | number>;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <a
      href={to}
      className={className}
      style={style}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.();
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
