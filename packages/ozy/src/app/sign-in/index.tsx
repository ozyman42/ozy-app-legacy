import * as React from 'react';
import { useAppState } from '../global-state';
import { GoogleSignIn } from './google';

export const SignIn: React.FC = () => {
    const { appData, signIn } = useAppState().appData.signIn.$;
    return (
        <div className='flex justify-center w-full items-center'>
            {
                appData === undefined ? <GoogleSignIn onSignIn={signIn} /> :
                <div>you have been signed in</div>
            }
        </div>
    );
}