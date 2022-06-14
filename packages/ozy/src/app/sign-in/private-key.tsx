import * as React from 'react';
import { upload } from '../utils/file';
import sshpk from 'sshpk';
import { Button, TextInput } from 'flowbite-react';

export const PrivKey: React.FC<{onKey: (privateKey: sshpk.PrivateKey, password: string, keyFile: string) => void, keyFile?: {contents: string, name: string}, onError: (error: string) => void}> = ({onKey, keyFile, onError}) => {
    const [password, setPassword] = React.useState("");
    const [uploadedKey, setUploadedKey] = React.useState<string | undefined>(undefined);
    const [uploadedKeyName, setUploadedKeyName] = React.useState<string | undefined>(undefined);
    function parsePrivKey(password: string, keyfile: string, filename: string) {
        try {
            const privkey = sshpk.parsePrivateKey(keyfile, 'auto', {passphrase: password.length > 0 ? password : undefined, filename});
            if (password.length === 0) {
                throw new Error("Only password-protected keys are supported. See ");
            }
            onKey(privkey, password, keyfile);
        } catch(e) {
            const error = e as Error;
            setPassword("");
            if (error.name === 'KeyEncryptedError') {
                setUploadedKey(keyfile);
                setUploadedKeyName(filename);
            } else {
                onError(error.message);
                console.log("failure to parse private key");
                console.log(error);
            }
        }
    }
    async function uploadPrivKey() {
        onError("");
        setPassword("");
        setUploadedKeyName(undefined);
        setUploadedKey(undefined);
        const {contents, filename} = await upload();
        parsePrivKey(password, contents, filename);
    }
    return (
        <div>
            {keyFile === undefined && uploadedKey === undefined && <Button className='m-auto' type="button" onClick={() => {uploadPrivKey();}}>Upload Private Key</Button>}
            {((uploadedKeyName !== undefined && uploadedKey !== undefined) || keyFile !== undefined) &&
                <form onSubmit={e => {e.preventDefault(); parsePrivKey(password, keyFile ? keyFile.contents : uploadedKey!, keyFile ? keyFile.name : uploadedKeyName!); }}>
                    <TextInput type="password" value={password} onChange={e => {setPassword(e.target.value);}} placeholder="enter password" className='mt-5' />
                    {password.length > 0 && <Button type="submit">Submit</Button>}
                </form>
            }
        </div>
    )
}