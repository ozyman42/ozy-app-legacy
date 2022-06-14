import React, { useEffect } from "react";
import { Button, Badge, TextInput } from 'flowbite-react';
import { clearFileId, FileIdErrorCode, getAccessToken, getAccessTokenIfPresent, getFileContents, getFileId, getFileIdIfPresent, newFile } from "./google-accessor";
import { PrivateKey } from "sshpk";
import { PrivKey } from "./private-key";
import { DocumentAppState, generateBlankDocumentAppState, validateDocumentAppState } from "../app-data";

export const GoogleSignIn: React.FC<{onSignIn: (keyPassword: string) => void}> = ({onSignIn: onSignInComplete}) => {
    const [error, setError] = React.useState("");
    const [accessToken, setAcccessToken] = React.useState<string | undefined>(undefined);
    const [fileId, setFileId] = React.useState<string | undefined>(undefined);
    const [newFileName, setNewFileName] = React.useState("");
    const [creatingNewFile, setCreatingNewFile] = React.useState(false);
    
    const [privateKey, setPrivateKey] = React.useState<PrivateKey | undefined>(undefined);
    const [keyPassword, setKeyPassword] = React.useState(""); // TODO: in the future let's try and allow for password storage via metamask & fingerprint
    const [keyfile, setKeyfile] = React.useState("");
    const [keyfileName, setKeyfilename] = React.useState("");
    
    useEffect(() => {
        console.log("use effect called");
        const maybeToken = getAccessTokenIfPresent();
        if (maybeToken !== undefined) {
            setAcccessToken(maybeToken.token);
        }

        const maybeTokenAndFileId = getFileIdIfPresent(maybeToken?.token);
        if (maybeTokenAndFileId !== undefined) {
            const {token, fileId} = maybeTokenAndFileId;
            console.log("found file id", fileId);
            setAcccessToken(token);
            setFileId(fileId);
            setError("");
        } else {
            console.log("did not find file id");
        }
    }, []);

    async function onSignInWithGoogle() {
        const tokenResponse = await getAccessToken();
        if (tokenResponse.type === 'error') {
            setError("You must consent to all google permissions for the app to work");
            return;
        }
        setAcccessToken(tokenResponse.token);
        setError("");
    }

    async function selectFile(token: string) {
        const fileIdResponse = await getFileId();
        if (fileIdResponse.type === 'error') {
            if (fileIdResponse.code === FileIdErrorCode.Cancelled) return;
            setError(`Unable to fetch file id: ${fileIdResponse.code}`);
            clearFileId();
            return;
        }
        const fileId = fileIdResponse.fileId;
        const contentsResponse = await getFileContents(fileId, token);
        if (contentsResponse.type === 'error') {
            setError(`Unable to fetch chosen file ${fileId} due to ${contentsResponse.code}: ${contentsResponse.message}`);
            clearFileId();
            return;
        }
        const {contents, title} = contentsResponse;
        let document: DocumentAppState | undefined;
        try {
            document = validateDocumentAppState(contents);
        } catch(e) {
            const error = e as Error;
            console.log(`failed to validate contents for file ${fileId}`);
            console.log(e);
            setError(`Bad format for file "${title}".\n${error.message}`);
            clearFileId();
            return;
        }
        setFileId(fileId);
        setKeyfile(document.key.encrypted);
        setKeyfilename(title);
        setError("");
    }

    async function createFile(accessToken: string, keyFile: string, privateKey: PrivateKey, keyPassword: string) {
        const filename = newFileName;
        const contents = generateBlankDocumentAppState(privateKey, keyFile);
        const result = await newFile(filename, accessToken, JSON.stringify(contents, null, 4));
        if (result.type === 'error') {
            setError(`Failed to create file ${filename}: ${result.code} ${result.message}`);
            return;
        }
        setFileId(result.fileId);
        setError("");
        onSignInComplete(keyPassword);
    }

    function rechooseFile() {
        setCreatingNewFile(false);
        setPrivateKey(undefined);
        setKeyPassword("");
        setKeyfile("");
        setKeyfilename("");
        setError("");
        setFileId(undefined);
        clearFileId();
    }
    
    return <div className="flex flex-col justify-center content-center">
        {accessToken === undefined && <Button onClick={onSignInWithGoogle} className="m-auto">Sign In With Google</Button>}
        {accessToken !== undefined && fileId === undefined && !creatingNewFile && <>
            <Button onClick={() => { selectFile(accessToken); }} className='m-auto'>Select Existing File</Button>
            <div className="m-auto mt-2 mb-2">or</div>
            <Button onClick={() => { setCreatingNewFile(true); setError(""); }} className="m-auto">Create New File</Button>
        </>}
        {accessToken !== undefined && creatingNewFile && <>
            <h5 className="text-2xl font-bold tracking-tight text-gray-900 mb-5 m-auto">
                Initialize App Database on Google Drive
            </h5>
            {privateKey === undefined && <PrivKey onKey={(key, password, keyFile) => { setPrivateKey(key); setKeyPassword(password); setKeyfile(keyFile); setKeyfilename(""); setError(""); }} onError={setError} />}
            {privateKey !== undefined &&
                <div className="m-auto">
                    <div className="inline-block"><TextInput onChange={e => { setNewFileName(e.target.value); }} value={newFileName} placeholder='Database file name' className="text-center" /></div>
                    <div className="ml-2 inline-block">{newFileName.length > 0 && <Button onClick={() => { createFile(accessToken, keyfile, privateKey, keyPassword); }}>Init</Button>}</div>
                </div>
            }
            {newFileName.length > 0 && <div className="m-auto mt-2">or</div>}
            <Button onClick={() => { rechooseFile(); }} className='mt-2 m-auto'>Back</Button>
        </>}
        {accessToken !== undefined && !creatingNewFile && fileId !== undefined && <>
            <PrivKey onKey={(key, password) => { setPrivateKey(key); setKeyPassword(password); setError(""); onSignInComplete(password); }} onError={setError} keyFile={{contents: keyfile, name: keyfileName}} />
            <Button onClick={() => { rechooseFile(); }} className='mt-2 m-auto'>Back</Button>
        </>}
        {error.length > 0 && <div className="mt-5 max-w-sm"><Badge color={'red'}>{error}</Badge></div>}
    </div>
}