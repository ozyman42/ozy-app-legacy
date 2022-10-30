const API_KEY = 'AIzaSyDui6a907Qq3QbRbBc_eIqG7WBdFl117sQ';
const CLIENT_ID = '688247567407-4418p3lv4vb4p2lp54fjt04kncan6nko.apps.googleusercontent.com';
const PROJECT_ID = 'ozy-app-352419';
const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
];

export enum AccessTokenErrorCode {
    SomeScopesDenies = 'SomeScopesDenied',
    FailedToFetchUserInformation = 'FailedToFetchUserInformation'
}

type SuccessAccessTokenResponse = {
    type: 'success';
    user: GoogleUser;
};

export type GoogleUser = {
    accessTokenExpiry: number;
    accessToken: string;
    accessTokenScopes: string[];
    email: string;
    name: string;
    imageUrl: string;
    userID: string;
}

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

export const clearAccessToken = () => { localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY); }

export const getAccessTokenIfPresent = (): SuccessAccessTokenResponse | undefined => {
    const tokenString = localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY);
    if (tokenString !== null) {
        const token: SuccessAccessTokenResponse = JSON.parse(tokenString);
        const expiresInOverOneMinute = (epochNow() + 60) < token.user.accessTokenExpiry;
        if (allScopesConsented(token.user.accessTokenScopes) && expiresInOverOneMinute) {
            console.log(`access token for ${token.user.name} expires in ${minutesFromNow(token.user.accessTokenExpiry)} minutes from now`);
            return token;
        }
        localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY);
    }
    return undefined;
}

type UserInfoResponse = {
    email: string;
    email_verified: boolean;
    family_name: string; // first name
    gvien_name: string; // last name
    locale: string; // "en"
    name: string; // First Last
    picture: string; // url
    sub: string; // unique google user id
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

    if (!google.accounts.oauth2.hasGrantedAllScopes(tokenResponse, ...SCOPES)) {
        return {type: "error", code: AccessTokenErrorCode.SomeScopesDenies};
    }
    const accessToken = tokenResponse.access_token;
    const userInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(accessToken)}`);
    if (userInfoResponse.status !== 200) {
        console.log("failed to fetch user info with access token", accessToken);
        console.log(await userInfoResponse.text());
        return {type: 'error', code: AccessTokenErrorCode.FailedToFetchUserInformation};
    }
    const userInfo: UserInfoResponse = await userInfoResponse.json();
    
    const token: SuccessAccessTokenResponse = {
        type: "success",
        user: {
            accessTokenExpiry: (epochNow() - 5) + tokenResponse.expires_in,
            accessToken,
            accessTokenScopes: tokenResponse.scope.split(" "),
            email: userInfo.email,
            name: userInfo.name,
            imageUrl: userInfo.picture,
            userID: userInfo.sub
        }
    };
    localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY, JSON.stringify(token));
    return token;
}

export enum FileIdErrorCode {
    NoFileChosen = 'NoFileChosen',
    NoAccessToken = 'NoAccessToken',
    Cancelled = 'Cancelled',
    InvalidFormat = 'InvalidFormat',
    UserMismatch = 'UserMismatch'
}

export type FileRecord = {
    fileId: string;
    fileName: string;
}

export type SuccessFileIdResponse = {
    type: 'success';
    fileId: FileRecord;
}

export type FileIdResponse = 
    {type: "error"; code: FileIdErrorCode;} |
    SuccessFileIdResponse;

export const getFileIdIfPresent = (userId: string): FileRecord | undefined => {
    const maybeFileId = localStorage.getItem(LOCAL_STORAGE_FILE_ID_KEY);
    if (maybeFileId === null) return undefined;
    const fileIdByUserId: Record<string, FileRecord> = JSON.parse(maybeFileId);
    if (fileIdByUserId[userId] === undefined) return undefined;
    return fileIdByUserId[userId];
}

export const clearFileId = (userId?: string) => {
    if (userId !== undefined) {
        const maybeFileId = localStorage.getItem(LOCAL_STORAGE_FILE_ID_KEY);
        if (maybeFileId === null) return;
        const fileIdByUserId: Record<string, FileRecord> = JSON.parse(maybeFileId);
        delete fileIdByUserId[userId];
        localStorage.setItem(LOCAL_STORAGE_FILE_ID_KEY, JSON.stringify(fileIdByUserId));
    } else {
        localStorage.removeItem(LOCAL_STORAGE_FILE_ID_KEY);
    }
}

export const getFile = async (user: GoogleUser): Promise<FileIdResponse> => {
    const maybeFileId = getFileIdIfPresent(user.userID);
    if (maybeFileId !== undefined) return {type: 'success', fileId: maybeFileId};
    await new Promise(callback => { gapi.load('picker', {callback}) });
    const accessTokenResponse = await getAccessToken();
    if (accessTokenResponse.type === 'error') {
        return {type: "error", code: FileIdErrorCode.NoAccessToken};
    }
    if (accessTokenResponse.user.userID !== user.userID) {
        return {type: 'error', code: FileIdErrorCode.UserMismatch};
    }
    const accessToken = accessTokenResponse.user.accessToken;
    const pickerView = new google.picker.View(google.picker.ViewId.DOCS);
    pickerView.setMimeTypes("application/vnd.google-apps.document");
    const choices = await new Promise<{docs: {id: string}[], cancelled: boolean}>(resolve => {
        function eventHandler(event: {action: 'loaded' | 'cancel';} | {action: 'picked'; docs: {id: string}[]}) {
            switch (event.action) {
                case 'cancel': 
                    resolve({docs: [], cancelled: true});
                    break;
                case 'picked':
                    resolve({docs: event.docs, cancelled: false});
                    break;
                case 'loaded':
                    break;
                default:
                    console.log('got unrecognized event', event);
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
    const CHOSEN: SuccessFileIdResponse = {type: 'success', fileId: id};

    const currentFiles = localStorage.getItem(LOCAL_STORAGE_FILE_ID_KEY);
    if (currentFiles === null) {
        localStorage.setItem(LOCAL_STORAGE_FILE_ID_KEY, JSON.stringify({[accessTokenResponse.user.userID]: id}));
    } else {
        const files: Record<string, string> = JSON.parse(currentFiles);
        files[accessTokenResponse.user.userID] = id;
        localStorage.setItem(LOCAL_STORAGE_FILE_ID_KEY, JSON.stringify(files));
    }

    return CHOSEN;
}

export enum GetFileErrorCode {
    NoSuchFile = 'NoSuchFile',
    OtherError = 'OtherError'
}

export type GetFileResponse =
    {type: 'error'; code: GetFileErrorCode; message: string;} |
    {type: 'success'; contents: string; title: string;};

function readDocumentResponse(parsed: {title: string, body: any}) {
    const {title, body: {content}} = parsed;
    const contentBuffer: string[] = [];
    for (const line of content) {
        if (line.paragraph === undefined) continue;
        for (const element of line.paragraph.elements) {
            if (element.textRun && element.textRun.content) {
                contentBuffer.push(element.textRun.content);
            }
        }
    }
    const contents = contentBuffer.join("");
    return {title, contents};
}

function getDocumentURI(fileId: string) {
    return `https://docs.googleapis.com/v1/documents/${fileId}`;
}

export const getFileContents = async (fileId: string, token: string): Promise<GetFileResponse> => {
    const result = await fetch(getDocumentURI(fileId), {headers: new Headers({'Authorization': `Bearer ${token}`})});
    if (result.status === 200) {
        const parsedResult = await result.json();
        console.log("got read result");
        console.log(parsedResult);
        console.trace();
        const { title, contents } = readDocumentResponse(parsedResult);
        return {type: 'success', contents, title};
    } else {
        return {type: 'error', code: GetFileErrorCode.OtherError, message: await result.text()};
    }
}

export enum NewFileErrorCode {
    FileAlreadyExists = 'FileAlreadyExists',
    InvalidName = 'InvalidName',
    OtherError = 'OtherError'
}

export type NewFileResponse = 
    {type: 'error';   code:   NewFileErrorCode; message: string;} |
    {type: 'success'; fileId: string;};

function getDocumentBatchUpdateURI(fileId: string) {
    return `${getDocumentURI(fileId)}:batchUpdate`;
}

export const newFile = async (name: string, user: GoogleUser, contents: string): Promise<NewFileResponse> => {
    const result = await fetch(`https://docs.googleapis.com/v1/documents`, {
        method: 'POST',
        headers: new Headers({ 'Authorization': `Bearer ${user.accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json' }),
        body: JSON.stringify({title: name})
    });
    if (result.status !== 200) {
        return {type: 'error', code: NewFileErrorCode.OtherError, message: await result.text()};
    }
    const parsed = await result.json();
    console.log("parsed", parsed);
    const fileId = parsed.documentId;
    const updateResult = await fetch(getDocumentBatchUpdateURI(fileId), {
        method: 'POST',
        headers: new Headers({ 'Authorization': `Bearer ${user.accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            requests: [
                {
                    insertText: {
                        text: contents,
                        location: {
                            index: 1
                        }
                    }
                },
                {
                    updateTextStyle: {
                        textStyle: {
                            fontSize: {
                                magnitude: 8,
                                unit: "PT"
                            },
                            weightedFontFamily: {
                                fontFamily: "Roboto Mono",
                                weight: 400
                            }
                        },
                        fields: "*",
                        range: {
                            startIndex: 1,
                            endIndex: contents.length + 2
                        }
                    }
                }
            ],
            // TODO: use google doc revision
        })
    });
    const updateResultStatus = updateResult.status;
    const updateResultBody = await updateResult.text();
    console.log("got update result");
    console.log(updateResultBody);
    if (updateResultStatus !== 200) {
        return {type: 'error', code: NewFileErrorCode.OtherError, message: updateResultBody};
    }
    const maybeFiles = localStorage.getItem(LOCAL_STORAGE_FILE_ID_KEY);
    if (maybeFiles === null) {
        localStorage.setItem(LOCAL_STORAGE_FILE_ID_KEY, JSON.stringify({[user.userID]: fileId}));
    } else {
        const existingFiles: Record<string, string> = JSON.parse(maybeFiles);
        existingFiles[user.userID] = fileId;
        localStorage.setItem(LOCAL_STORAGE_FILE_ID_KEY, JSON.stringify(existingFiles));
    }
    return {type: 'success', fileId};
}

export enum UpdateFileError {
    FailedToFetchFile = 'FailedToFetchFile',
    FailedToUpdate = 'FailedToUpdate'
}

export type UpdateFileResponse =
    {success: true} |
    {success: false; code: UpdateFileError; details: string};

export async function updateContent(user: GoogleUser, fileId: string, newContent: string): Promise<UpdateFileResponse> {
    const read = await getFileContents(fileId, user.accessToken);
    if (read.type === 'error') {
        return {
            success: false, code: UpdateFileError.FailedToFetchFile,
            details: `Failed to fetch file due to ${read.code}: ${read.message}`
        };
    }
    const updateResult = await fetch(getDocumentBatchUpdateURI(fileId), {
        method: 'POST',
        headers: new Headers({ 'Authorization': `Bearer ${user.accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            requests: [
                {
                    deleteContentRange: {
                        range: {
                            startIndex: 1,
                            endIndex: read.contents.length + 1
                        }
                    }
                },
                {
                    insertText: {
                        text: newContent,
                        location: {
                            index: 1
                        }
                    }
                },
                {
                    updateTextStyle: {
                        textStyle: {
                            fontSize: {
                                magnitude: 8,
                                unit: "PT"
                            },
                            weightedFontFamily: {
                                fontFamily: "Roboto Mono",
                                weight: 400
                            }
                        },
                        fields: "*",
                        range: {
                            startIndex: 1,
                            endIndex: newContent.length + 2
                        }
                    }
                }
            ]
        })
    });
    if (updateResult.status !== 200) {
        return {
            success: false, code: UpdateFileError.FailedToUpdate,
            details: `Failed to update file ${await updateResult.text()}`
        }
    }
    console.log("got update result");
    console.log(await updateResult.text());
    console.log("performing second read");
    const anotherRead = await getFileContents(fileId, user.accessToken);
    if (anotherRead.type === 'error') {
        return {
            success: false, code: UpdateFileError.FailedToFetchFile,
            details: `Failed second read due to ${anotherRead.code}: ${anotherRead.message}`
        };
    }
    console.log("second read completed");
    return {success: true};
}