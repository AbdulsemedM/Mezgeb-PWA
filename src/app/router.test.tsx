import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  Link,
  matchPath,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from './router';

describe('router', () => {
  it('matches patterns with params, exactly', () => {
    expect(matchPath('/shops/:accountId/pay', '/shops/acc-1/pay')).toEqual({ accountId: 'acc-1' });
    expect(matchPath('/shops/:accountId', '/shops/acc-1/pay')).toBeNull();
    expect(matchPath('/', '/')).toEqual({});
    expect(matchPath('/i/:code', '/i/K7M2%2DP9QX')).toEqual({ code: 'K7M2-P9QX' });
    expect(matchPath('*', '/anything/at/all')).toEqual({});
  });

  function Show() {
    const { accountId } = useParams();
    const [params] = useSearchParams();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    return (
      <div>
        <p>
          {pathname} {accountId} {params.get('payme')}
        </p>
        <button type="button" onClick={() => navigate(-1)}>
          back
        </button>
        <Link to="/shops/b">to b</Link>
      </div>
    );
  }

  const app = (start: string) => (
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/shops/:accountId" element={<Show />} />
        <Route path="/old" element={<Navigate to="/shops/new" replace />} />
        <Route path="*" element={<p>fallback</p>} />
      </Routes>
    </MemoryRouter>
  );

  it('renders the matching route with its params and query', () => {
    render(app('/shops/a?payme=p-1'));
    expect(screen.getByText('/shops/a a p-1')).toBeInTheDocument();
  });

  it('links navigate in place, and back goes back', async () => {
    render(app('/shops/a'));
    await userEvent.click(screen.getByRole('link', { name: 'to b' }));
    expect(screen.getByText(/\/shops\/b b/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'to b' })).toHaveAttribute('href', '/shops/b');
    await userEvent.click(screen.getByRole('button', { name: 'back' }));
    expect(screen.getByText(/\/shops\/a a/)).toBeInTheDocument();
  });

  it('Navigate redirects; unknown paths get the fallback', async () => {
    render(app('/old'));
    expect(await screen.findByText(/\/shops\/new new/)).toBeInTheDocument();
    render(app('/nowhere'));
    expect(screen.getByText('fallback')).toBeInTheDocument();
  });
});
