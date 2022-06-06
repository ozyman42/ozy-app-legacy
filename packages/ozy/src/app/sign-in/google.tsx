import React, { useEffect } from "react";
import jwtDecode from 'jwt-decode';
import { Button, Badge, TextInput } from 'flowbite-react';
import { FileIdErrorCode, getAccessToken, getAccessTokenIfPresent, getFileId, getFileIdIfPresent, newFile } from "./google-accessor";

export const GoogleSignIn: React.FC<{onSignIn: (accessToken: string, fileId: string) => void}> = ({onSignIn: onSignInComplete}) => {
    const [error, setError] = React.useState("");
    const [accessToken, setAcccessToken] = React.useState<string | undefined>(undefined);
    const [fileId, setFileId] = React.useState<string | undefined>(undefined);
    const [newFileName, setNewFileName] = React.useState("");
    const [creatingNewFile, setCreatingNewFile] = React.useState(false);
    
    useEffect(() => {
        console.log("use effect called");
        const maybeToken = getAccessTokenIfPresent();
        if (maybeToken !== undefined) {
            setAcccessToken(maybeToken.token);
        }

        const maybeTokenAndFileId = getFileIdIfPresent(maybeToken?.token);
        if (maybeTokenAndFileId !== undefined) {
            const {token, fileId} = maybeTokenAndFileId;
            setAcccessToken(token);
            setFileId(fileId);
            setError("");
            onSignInComplete(token, fileId);
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

    async function selectFile() {
        const fileIdResponse = await getFileId();
        if (fileIdResponse.type === 'error') {
            if (fileIdResponse.code === FileIdErrorCode.Cancelled) return;
            setError(`Unable to fetch file id: ${fileIdResponse.code}`);
            return;
        }
        setFileId(fileIdResponse.fileId);
        setError("");
        const {token, fileId} = fileIdResponse;
        onSignInComplete(token, fileId);
    }

    async function createFile(accessToken: string) {
        const filename = newFileName;
        const result = await newFile(filename, accessToken);
        if (result.type === 'error') {
            setError(`Failed to create file ${filename}: ${result.code} ${result.message}`);
            return;
        }
        setFileId(result.fileId);
        setError("");
        onSignInComplete(accessToken, result.fileId);
    }
    
    return <div className="flex flex-col justify-center content-center">
        {accessToken === undefined && <Button onClick={onSignInWithGoogle} className="m-auto">Sign In With Google</Button>}
        {accessToken !== undefined && fileId === undefined && !creatingNewFile && <>
            <Button onClick={selectFile} className='m-auto'>Select Existing File</Button>
            <div className="m-auto mt-2 mb-2">or</div>
            <Button onClick={() => { setCreatingNewFile(true); }} className="m-auto">Create New File</Button>
        </>}
        {accessToken !== undefined && creatingNewFile && <>
            <div className="m-auto">
                <div className="inline-block"><TextInput onChange={e => { setNewFileName(e.target.value); }} value={newFileName} placeholder='New file name' className="text-center" /></div>
                <div className="ml-2 inline-block">{newFileName.length > 0 && <Button onClick={() => { createFile(accessToken); }}>Create New File</Button>}</div>
            </div>
            
            {newFileName.length > 0 && <div className="m-auto mt-2">or</div>}
            <Button onClick={() => { setCreatingNewFile(false); }} className='mt-2 m-auto'>Back</Button>
        </>}
        {error.length > 0 && <div className="mt-5"><Badge color={'red'}>{error}</Badge></div>}
    </div>
}