import { Route, Routes, Navigate } from 'react-router-dom';
import { PAGES, SIGN_IN_PATH, HOME_PATH, REDIRECT_QUERY_PARAM, isSignedIn } from './global-state';
import { Nav } from './nav';
import { useAppState } from './global-state';
import { SignIn } from './sign-in';
import { Home } from './home';

export function App() {
  const { signInData } = useAppState().signInData.$;
  const redirectTo = new URLSearchParams(window.location.search).get(REDIRECT_QUERY_PARAM);
  return (
    <div className='h-full flex flex-col'>
      <Nav />
      <div className='flex grow'>
        <Routes>
          <Route path={SIGN_IN_PATH} element={<>
            { isSignedIn(signInData) && redirectTo !== null && <Navigate to={redirectTo} replace={true} /> }
            <SignIn />
          </>} />
          <Route path={HOME_PATH} element={<Home />} />
          {Object.entries(PAGES).map(([page, info]) => (
            <Route path={info.path} element={
              <div>
                { !isSignedIn(signInData) && <Navigate to={`${SIGN_IN_PATH}?${REDIRECT_QUERY_PARAM}=${encodeURIComponent(info.path)}`} replace={true} /> }
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
