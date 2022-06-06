import { Route, Routes, Navigate } from 'react-router-dom';
import { PAGES, SIGN_IN_PATH, HOME_PATH, REDIRECT_QUERY_PARAM } from './global-state';
import { Nav } from './nav';
import { useAppState } from './global-state';
import { SignIn } from './sign-in';
import { Home } from './home';

export function App() {
  const { signedIn } = useAppState().signedIn.$;
  const redirectTo = new URLSearchParams(window.location.search).get(REDIRECT_QUERY_PARAM);
  return (
    <div className='h-full flex flex-col'>
      <Nav />
      <div className='flex grow'>
        <Routes>
          <Route path={SIGN_IN_PATH} element={<>
            { signedIn.key !== undefined && <Navigate to={redirectTo ?? HOME_PATH} replace={true} /> }
            <SignIn />
          </>} />
          <Route path={HOME_PATH} element={<Home />} />
          {Object.entries(PAGES).map(([page, info]) => (
            <Route path={info.path} element={
              <div>
                { signedIn.key === undefined && <Navigate to={`${SIGN_IN_PATH}?${REDIRECT_QUERY_PARAM}=${encodeURIComponent(info.path)}`} replace={true} /> }
                <Nav />
                <info.render />
              </div>
            } key={page} />
          ))}
        </Routes>
      </div>
    </div>
  );
}

export default App;
