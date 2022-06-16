import * as React from 'react';
import { GoogleSignIn } from './google';

export const SignIn: React.FC = () => {
    return (
        <div className='flex justify-center w-full items-center'>
            <GoogleSignIn />
        </div>
    );
}