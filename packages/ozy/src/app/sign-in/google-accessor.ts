const API_KEY = 'AIzaSyDui6a907Qq3QbRbBc_eIqG7WBdFl117sQ';
const CLIENT_ID = '688247567407-4418p3lv4vb4p2lp54fjt04kncan6nko.apps.googleusercontent.com';
const PROJECT_ID = 'ozy-app-352419';
const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
];

export enum AccessTokenErrorCode {
    SomeScopesDenies = 'SomeScopesDenied'
}

type SuccessAccessTokenResponse = {type: 'success'; expiry: number; token: string; scopes: string[]};

export type AccessTokenResponse =
    {type: 'error'; code: AccessTokenErrorCode} |
    SuccessAccessTokenResponse;

type GoogleAccessTokenResponse = {
    access_token: string;
    authuser: string; // "0"
    expires_in: number;
    prompt: string;
    scope: string;
    token_type: string; // "Bearer"
}

const { google, gapi } = (window as any);

const LOCAL_STORAGE_ACCESS_TOKEN_KEY = "googleAccessToken";
const LOCAL_STORAGE_FILE_ID_KEY = "googleFileId";

export function signOut() {
    localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY);
    localStorage.removeItem(LOCAL_STORAGE_FILE_ID_KEY);
}

function allScopesConsented(scopes: string[]) {
    const scopesSet = new Set(scopes);
    for (const scope of SCOPES) {
        if (!scopesSet.has(scope)) return false;
    }
    return true;
}

function epochNow() {
    return Math.floor(Date.now() / 1000);
}

function minutesFromNow(time: number) {
    return Math.round((time - epochNow()) / 60);
}

export const getAccessTokenIfPresent = (): SuccessAccessTokenResponse | undefined => {
    const tokenString = localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY);
    if (tokenString !== null) {
        const token: SuccessAccessTokenResponse = JSON.parse(tokenString);
        const expiresInOverOneMinute = (epochNow() + 60) < token.expiry;
        if (allScopesConsented(token.scopes) && expiresInOverOneMinute) {
            console.log(`token ${token.token} expires in ${minutesFromNow(token.expiry)} minutes from now`);
            return token;
        }
        localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY);
    }
    return undefined;
}

export const getAccessToken = async (): Promise<AccessTokenResponse> => {
    const maybeSavedToken = getAccessTokenIfPresent();
    if (maybeSavedToken !== undefined) {
        return maybeSavedToken;
    }
    const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES.join(" "),
        callback: () => { throw new Error("placeholder callback called"); }
    });
    const tokenResponse = await new Promise<GoogleAccessTokenResponse>(resolve => {
        client.callback = resolve;
        client.requestAccessToken();
    });
    if (google.accounts.oauth2.hasGrantedAllScopes(tokenResponse, ...SCOPES)) {
        const token: SuccessAccessTokenResponse = {
            type: "success",
            expiry: (epochNow() - 5) + tokenResponse.expires_in,
            token: tokenResponse.access_token,
            scopes: tokenResponse.scope.split(" ")
        };
        console.log(`token ${token.token} expires in ${minutesFromNow(token.expiry)} minutes from now`);
        localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY, JSON.stringify(token));
        return token;
    } else {
        return {type: "error", code: AccessTokenErrorCode.SomeScopesDenies};
    }
}

export enum FileIdErrorCode {
    NoFileChosen = 'NoFileChosen',
    NoAccessToken = 'NoAccessToken',
    Cancelled = 'Cancelled',
    InvalidFormat = 'InvalidFormat'
}

export type SuccessFileIdResponse = {
    type: 'success';
    fileId: string;
    token: string;
}

export type FileIdResponse = 
    {type: "error"; code: FileIdErrorCode;} |
    SuccessFileIdResponse;

export const getFileIdIfPresent = (token?: string): SuccessFileIdResponse | undefined => {
    const maybeFileId = localStorage.getItem(LOCAL_STORAGE_FILE_ID_KEY);
    const maybeToken = token ? token : getAccessTokenIfPresent()?.token;
    if (maybeFileId !== null && maybeToken !== undefined) {
        return {type: 'success', fileId: maybeFileId, token: maybeToken};
    }
    return undefined;
}

export const getFileId = async (token?: string): Promise<FileIdResponse> => {
    const maybeFileId = getFileIdIfPresent(token);
    if (maybeFileId !== undefined) return maybeFileId;
    await new Promise(callback => { gapi.load('picker', {callback}) });
    const accessTokenResponse = await getAccessToken();
    if (accessTokenResponse.type === 'error') {
        return {type: "error", code: FileIdErrorCode.NoAccessToken};
    }
    const accessToken = accessTokenResponse.token;
    const pickerView = new google.picker.View(google.picker.ViewId.DOCS);
    pickerView.setMimeTypes("application/vnd.google-apps.document");
    const choices = await new Promise<{docs: {id: string}[], cancelled: boolean}>(resolve => {
        function eventHandler(event: {action: 'loaded' | 'cancel';} | {action: 'picked'; docs: {id: string}[]}) {
            console.log(`got event`, event);
            switch (event.action) {
                case 'cancel': 
                    resolve({docs: [], cancelled: true});
                    break;
                case 'picked':
                    resolve({docs: event.docs, cancelled: false});
                    break;
            }
        }
        const picker = new google.picker.PickerBuilder()
            .enableFeature(google.picker.Feature.NAV_HIDDEN)
            .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
            .setAppId(PROJECT_ID)
            .setOAuthToken(accessToken)
            .addView(pickerView)
            .addView(new google.picker.DocsUploadView())
            .setDeveloperKey(API_KEY)
            .setCallback(eventHandler)
            .build();
        picker.setVisible(true);
    });
    
    const { docs, cancelled } = choices;
    if (cancelled) {
        return {type: 'error', code: FileIdErrorCode.Cancelled};
    }
    const NONE_CHOSEN: FileIdResponse = {type: 'error', code: FileIdErrorCode.NoFileChosen};
    if (docs.length === 0) {
        return NONE_CHOSEN;
    }
    const id = docs[0].id;
    const CHOSEN: SuccessFileIdResponse = {type: 'success', fileId: id, token: accessToken};
    localStorage.setItem(LOCAL_STORAGE_FILE_ID_KEY, id);
    return CHOSEN;
}

export enum NewFileErrorCode {
    FileAlreadyExists = 'FileAlreadyExists',
    InvalidName = 'InvalidName',
    OtherError = 'OtherError'
}

export type NewFileResponse = 
    {type: 'error';   code:   NewFileErrorCode; message: string;} |
    {type: 'success'; fileId: string;};

export const newFile = async (name: string, token: string): Promise<NewFileResponse> => {
    const result = await fetch(`https://docs.googleapis.com/v1/documents?title=${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: new Headers({ 'Authorization': `Bearer ${token}` })
    });
    if (result.status === 200) {
        const parsed = await result.json();
        const fileId = parsed.documentId;
        localStorage.setItem(LOCAL_STORAGE_FILE_ID_KEY, fileId);
        return {type: 'success', fileId};
    } else {
        return {type: 'error', code: NewFileErrorCode.OtherError, message: await result.text()};
    }
}