import React, { useEffect } from "react";
import { Button, Badge, TextInput, Avatar } from 'flowbite-react';
import { clearAccessToken, clearFileId, FileIdErrorCode, getAccessToken, getAccessTokenIfPresent,
    getFileContents, getFileId, getFileIdIfPresent, GoogleUser, newFile } from "./google-accessor";
import { DocumentAppState, generateBlankDocumentAppState, validateDocumentAppState } from "../app-data";
import PasswordStrengthBar from 'react-password-strength-bar';
import { EncryptPasswordMethod, SignInData, useAppState } from "../global-state";

export enum SignInError {
    BadPassword = 'BadPassword',
    OtherError = 'OtherError'
}

export type SignInResult =
    {success: false; code: SignInError; details: string;} |
    {success: true};

type PasswordEncryptionMethodRecord = 
    {type: EncryptPasswordMethod.Fingerprint} |
    {type: EncryptPasswordMethod.Metamask; encrypted: string; publicKey: string;};
type PasswordEncryptionMethodStore = Record<string, PasswordEncryptionMethodRecord>; // Here the key is user id

const LOCAL_STORAGE_PASSWORD_ENCRYPTION_METHOD = "passwordEncryptionMethod";

export function clearPasswordEncryptionMethod(userId?: string) {
    if (userId !== undefined) {
        const encryptionMethods = localStorage.getItem(LOCAL_STORAGE_PASSWORD_ENCRYPTION_METHOD);
        if (encryptionMethods !== null) {
            const parsedEncryptionMethods: PasswordEncryptionMethodStore = JSON.parse(encryptionMethods);
            delete parsedEncryptionMethods[userId];
            localStorage.setItem(LOCAL_STORAGE_PASSWORD_ENCRYPTION_METHOD, JSON.stringify(parsedEncryptionMethods));
        }
    } else {
        localStorage.removeItem(LOCAL_STORAGE_PASSWORD_ENCRYPTION_METHOD);
    }
}

export function getPasswordEncryptionMethod(userId: string): PasswordEncryptionMethodRecord | undefined {
    const encryptionMethods = localStorage.getItem(LOCAL_STORAGE_PASSWORD_ENCRYPTION_METHOD);
    if (encryptionMethods === null) return undefined;
    const parsedEncryptionMethods: PasswordEncryptionMethodStore = JSON.parse(encryptionMethods);
    return parsedEncryptionMethods[userId];
}

export const GoogleSignIn: React.FC = () => {
    const { 
        signInData: { googleUser, databaseFileId, databaseFileName, password, encryptPasswordMethod },
        signIn, signOut
    } = useAppState().signInData.signIn.signOut.$;
    const [creatingNewFile, setCreatingNewFile] = React.useState(false);
    
    const [error, setError] = React.useState("");
    const [newFileName, setNewFileName] = React.useState("");
    const [passwordScore, setPasswordScore] = React.useState(0);
    const [enteredPassword, setEnteredPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    
    function clearFields() {
        setError("");
        setNewFileName("");
        setEnteredPassword("");
        setConfirmPassword("");
    }

    function loadAccessTokenIfPresent(signInData: Partial<SignInData>) {
        const maybeToken = getAccessTokenIfPresent();
        if (maybeToken !== undefined) {
            signInData.googleUser = maybeToken.user;
        } else {
            clearAccessToken();
            signInData.googleUser = undefined;
        }
    }

    async function loadFileIdIdPresent(signInData: Partial<SignInData>) {
        const user = signInData.googleUser;
        if (user === undefined) return;
        const maybeFileId = getFileIdIfPresent(user.userID);
        if (maybeFileId !== undefined) {
            const response = await getFileContents(maybeFileId, user.accessToken);
            if (response.type === 'error') {
                console.log("Error fetching file.", response.code, response.message);
                setError(`Failed to fetch selected file. Deselecting it.`);
                clearFileId(user.userID);
                signInData.databaseFileId = undefined;
                signInData.databaseFileName = undefined;
            } else {
                const {contents, title} = response;
                let document: DocumentAppState | undefined;
                try {
                    document = validateDocumentAppState(contents);
                } catch(e) {
                    const error = e as Error;
                    console.log(`failed to validate contents for file ${title}. id = ${maybeFileId}`);
                    console.log(e);
                    setError(`Bad format for file "${title}". Deselecting it.`);
                    clearFileId(user.userID);
                    signInData.databaseFileId = undefined;
                    signInData.databaseFileName = undefined;
                    return;
                }
                signInData.databaseFileId = maybeFileId;
                signInData.databaseFileName = title;
            }
        } else {
            clearFileId(user.userID);
            signInData.databaseFileId = undefined;
            signInData.databaseFileName = undefined;
        }
    }

    async function loadPasswordEncryptionMethodIfPresent(signInData: Partial<SignInData>) {
        const user = signInData.googleUser;
        if (user === undefined) return;
        const maybeEncryptionMethod = getPasswordEncryptionMethod(user.userID);
        if (maybeEncryptionMethod === undefined) {
            signInData.encryptPasswordMethod = undefined;
            return;
        }
        const method = Object.keys(EncryptPasswordMethod).find(method => method === maybeEncryptionMethod.type);
        if (method === undefined) {
            console.log(`Local storage has invalid password encryption method of "${maybeEncryptionMethod.type}". Clearing.`);
            signInData.encryptPasswordMethod = undefined;
            clearPasswordEncryptionMethod(user.userID);
            return;
        }
        const verifiedMethod = maybeEncryptionMethod.type;

        // TODO: based on method, extract the password
    }

    async function loadAllIfPresent() {
        const signInData: Partial<SignInData> = {};
        loadAccessTokenIfPresent(signInData);
        await loadFileIdIdPresent(signInData);
        await loadPasswordEncryptionMethodIfPresent(signInData);
        await signIn(signInData);
    }

    useEffect(() => {
        (async () => {
            clearFields();
            await loadAllIfPresent()
        })();
    }, []);

    async function onSignInWithGoogle() {
        const tokenResponse = await getAccessToken();
        if (tokenResponse.type === 'error') {
            setError("You must consent to all google permissions for the app to work");
            return;
        }
        clearFields();
        await loadAllIfPresent();
    }

    async function selectFile(user: GoogleUser) {
        const fileIdResponse = await getFileId(user);
        if (fileIdResponse.type === 'error') {
            if (fileIdResponse.code === FileIdErrorCode.Cancelled) return;
            setError(`Unable to fetch file id: ${fileIdResponse.code}`);
            clearFileId(user.userID);
            return;
        }
        clearFields();
        await loadAllIfPresent();
    }

    async function createFile(user: GoogleUser, password: string) {
        const filename = newFileName;
        const contents = generateBlankDocumentAppState(password);
        const result = await newFile(filename, user, JSON.stringify(contents, null, 4));
        if (result.type === 'error') {
            setError(`Failed to create file ${filename}: ${result.code} ${result.message}`);
            return;
        }
        clearFields();
        setCreatingNewFile(false);
        await loadAllIfPresent();
    }

    async function rechooseFile(user: GoogleUser) {
        setCreatingNewFile(false);
        clearFields();
        clearFileId(user.userID);
        clearPasswordEncryptionMethod(user.userID);
        await loadAllIfPresent();
        await signIn({password: undefined});
    }

    async function signInViaPassword() {
        const result = await signIn({password: enteredPassword});
        if (!result.success) {
            setError(result.details);
        } else {
            clearFields();
        }
    }

    function now() {
        return Math.floor(Date.now() / 1000);
    }

    const AccessTokenExpiry: React.FC<{expiry: number}> = ({expiry}) => {
        const [time, setTime] = React.useState(now())
        useEffect(() => {
            const interval = setInterval(() => {
                setTime(now());
            }, 200)
            return () => {
                clearInterval(interval);
            }
        }, [expiry]);
        const difference = expiry - time;
        const minutes = Math.floor(difference / 60);
        const seconds = difference % 60;
        return <>
            {difference <= 0 && <>token expired</>}
            {difference > 0 && <>token expiry in {minutes}m {seconds}s</>}
        </>
    }

    const createSubmitAllowed = enteredPassword.length > 0 && confirmPassword === enteredPassword && newFileName.length > 0 && passwordScore >= 3;
    const signinSubmitAllowed = enteredPassword.length > 0;
    const headerClass = "text-2xl font-bold tracking-tight text-gray-900 mb-5 m-auto text-center";
    const googleDocsIconImageUrl = "https://v5yd3ndtnmpd6dr7kqqyjbyh3crn66rzv334wcjjlh6fmky4.arweave.net/r3A-9tHNrHj8OP1QhhIcH_2KLfejmu_98sJKVn8Visc";

    return <div className="flex flex-col justify-center content-center">
        {googleUser === undefined && <Button onClick={onSignInWithGoogle} className="m-auto">Sign In With Google</Button>}
        {googleUser !== undefined && <div className="m-auto w-72">
            <hr className="mb-5" />
            <Avatar img={googleUser.imageUrl} rounded={true} size="lg" bordered={true}>
                <div className="space-y-1 font-medium">
                    <div>
                        signed in as <b>{googleUser.name}</b>
                    </div>
                    <div className="text-sm text-gray-500">
                        {googleUser.email}<br/><AccessTokenExpiry expiry={googleUser.accessTokenExpiry} />
                    </div>
                    <Button size="xs" onClick={() => { signOut() }}>Sign Out</Button>
                </div>
            </Avatar>
            <hr className="mt-5 mb-5" />
        </div>}
        {googleUser !== undefined && databaseFileId !== undefined && <div className="m-auto w-72">
            <Avatar img={googleDocsIconImageUrl} rounded={true} size='lg' bordered={true}>
                <div className="space-y-1 font-medium">
                    <div>
                        database file: <b>{databaseFileName}</b>
                    </div>
                    <div className="text-sm text-gray-500">
                        {password === undefined ? 'Locked' : 'Unlocked'}
                    </div>
                    <Button size="xs" onClick={() => { rechooseFile(googleUser); }}>Close File</Button>
                </div>
            </Avatar>
            <hr className="mt-5 mb-5" />
        </div>}
        {googleUser !== undefined && databaseFileId === undefined && !creatingNewFile && <div className="m-auto">
            <h5 className={headerClass}>Select Database from<br />Google Drive</h5>
            <div className="flex justify-around ">
                <Button onClick={() => { selectFile(googleUser); }}>Use Existing File</Button>
                <Button className="ml-3" onClick={() => { setCreatingNewFile(true); setError(""); }}>Create New File</Button>
            </div>
        </div>}
        {googleUser !== undefined && creatingNewFile && <>
            <h5 className={headerClass}>
                Initialize Database on<br/>Google Drive
            </h5>
            <form onSubmit={e => { e.preventDefault(); if (createSubmitAllowed) { createFile(googleUser, enteredPassword); /* Here we should add an input to encrypt via fingerprint/metamask */ } }}>
                <div className="m-auto">
                    <div><TextInput onChange={e => { setNewFileName(e.target.value); }} value={newFileName} placeholder='database file name' className="text-center" /></div>
                    <div className="mt-3"><TextInput type='password' placeholder="encryption password" onChange={e => { setEnteredPassword(e.target.value); }} className='text-center' /></div>
                    <PasswordStrengthBar password={enteredPassword} onChangeScore={setPasswordScore} />
                    <div className="mt-3"><TextInput type='password' placeholder="confirm password" onChange={e => { setConfirmPassword(e.target.value); }} className='text-center' /></div>
                    <div className="mt-1">
                        {(enteredPassword.length > 0 || confirmPassword.length > 0) && enteredPassword !== confirmPassword && <Badge color={'red'}>Passwords don't match</Badge>}
                        {(enteredPassword.length > 0 || confirmPassword.length > 0) && enteredPassword === confirmPassword && <Badge color={'green'}>Passwords match</Badge>}
                    </div>
                </div>
                <div className="m-auto mt-4 flex justify-around">
                    <Button type='submit' disabled={!createSubmitAllowed}>Submit</Button>
                    <Button onClick={() => { rechooseFile(googleUser); }}>Back</Button>
                </div>
            </form>
        </>}
        {googleUser !== undefined && !creatingNewFile && databaseFileId !== undefined && password === undefined && <>
            <h5 className={headerClass}>
                Unlock Database
            </h5>
            {encryptPasswordMethod === undefined && <>
                <form onSubmit={e => { e.preventDefault(); if (signinSubmitAllowed) { signInViaPassword(); } }}>
                    <div><TextInput type='password' placeholder="encryption password" onChange={e => { setEnteredPassword(e.target.value); }} className='text-center' /></div>
                    {/* TODO: here we should add ability to check for what password-less sign on options are available */}
                    <div className="m-auto mt-3 flex flex-row justify-around">
                        <Button type='submit' disabled={!signinSubmitAllowed}>Sign In</Button>
                    </div>
                </form>
            </>}
            {encryptPasswordMethod !== undefined && <div>TODO: implement password encryption methods</div>}
        </>}
        {error.length > 0 && <div className="mt-5 max-w-sm"><Badge color={'red'}>{error}</Badge></div>}
    </div>
}