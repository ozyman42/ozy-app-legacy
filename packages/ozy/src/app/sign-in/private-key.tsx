import * as React from 'react';
import { upload } from '../utils/file';
import sshpk from 'sshpk';

export const PrivKey: React.FC<{onKey: (privateKey: sshpk.PrivateKey, password: string) => void}> = ({onKey}) => {
    const [error, setError] = React.useState("");
    const [keyfile, setKeyFile] = React.useState("");
    const [passwordRequired, setPasswordRequired] = React.useState(false);
    const [password, setPassword] = React.useState("");
    function parsePrivKey(password: string, keyfile: string) {
        try {
            const privkey = sshpk.parsePrivateKey(keyfile, 'auto', {passphrase: password.length > 0 ? password : undefined});
            if (password.length === 0) {
                throw new Error("Only password-protected keys are supported. See ");
            }
            onKey(privkey, password);
        } catch(e) {
            const error = e as Error;
            setPassword("");
            if (error.name === 'KeyEncryptedError') {
                setPasswordRequired(true);
            } else {
                throw e;
            }
        }
    }
    async function uploadPrivKey() {
        setError("");
        setPassword("");
        setPasswordRequired(false);
        const keyfile = await upload();
        setKeyFile(keyfile);
        parsePrivKey(password, keyfile);
    }
    return (
        <div>
            <input type="button" value="Upload Private Key" onClick={() => {uploadPrivKey();}} />
            {passwordRequired && <form onSubmit={e => {e.preventDefault(); parsePrivKey(password, keyfile); }}>
                <input type="password" value={password} onChange={e => {setPassword(e.target.value);}} placeholder="enter password" />
                {password.length > 0 && <input type="submit" value="Use Priv Key w/ Password" />}
            </form>}
            {error.length > 0 && <div style={{color: 'red'}}>{error}</div>}
        </div>
    )
}