import * as React from 'react';
import { useAppState } from '../global-state';
import { GoogleSignIn } from './google';
import { PrivKey } from './private-key';
import { Password } from './password';

export const SignIn: React.FC = () => {
    const { signedIn } = useAppState().signedIn.$
    return (
        <div className='flex justify-center w-full items-center'>
            {
                signedIn.google === undefined ? <GoogleSignIn onSignIn={(token, file) => { console.log(`got token ${token} and file ${file}`) }} /> :
                signedIn.google.serializedKey === undefined ? <PrivKey onKey={(privateKey, password) => {}} /> :
                signedIn.key === undefined ? <Password /> :
                <div>you have been signed in</div>
            }
        </div>
    );
}