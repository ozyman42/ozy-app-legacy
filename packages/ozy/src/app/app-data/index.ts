import { SignInData } from "../global-state";
import { getBlankScheduleState, ScheduleState } from "../schedule/state";
import { getFileContents, GetFileErrorCode } from "../sign-in/google-accessor";
import { decrypt, encrypt, genSalt, genUUID } from '../utils/crypto';

export enum SubApp {
    Schedule      = 'Schedule',
    Taxes         = 'Taxes',
    Trading       = 'Trading',
    YieldFarming  = 'YieldFarming',
    Budgeting     = 'Budgeting'
}

type SubAppsState = {[app in SubApp]: VersionedState};

type VersionedState = {version: number;};

type DeserializedAppData<SubAppStateTypes extends SubAppsState> = {
    revision: string;
    data: SubAppStateTypes;
};

export type SubAppStateTypes = {
    [SubApp.Schedule]: ScheduleState;
    [SubApp.Taxes]: {version: 1;};
    [SubApp.Trading]: {version: 1;};
    [SubApp.YieldFarming]: {version: 1;};
    [SubApp.Budgeting]: {version: 1;};
}

export function generateBlankDocumentAppState(encryptionPassword: string) {
    return generateDocumentAppState({
        [SubApp.Schedule]: getBlankScheduleState(),
        [SubApp.Taxes]: {version: 1},
        [SubApp.Trading]: {version: 1},
        [SubApp.YieldFarming]: {version: 1},
        [SubApp.Budgeting]: {version: 1},
    }, encryptionPassword);
}

type EncryptedContent = {
    salts: [string, string];
    appState: AppData['data']
}

export function generateDocumentAppState(appState: SubAppStateTypes, encryptionPassword: string): DocumentAppState {
    const ivSalt = genSalt();
    const keySalt = genSalt();
    const toEncrypt: EncryptedContent = {
        salts: [keySalt, ivSalt],
        appState
    };
    return {
        salt: [keySalt, ivSalt],
        revision: genUUID(),
        encrypted: encrypt(JSON.stringify(toEncrypt), encryptionPassword, keySalt, ivSalt)
    }
}

export type AppData = DeserializedAppData<SubAppStateTypes>;

export type DocumentAppState = {
    salt: [string, string];
    revision: string;
    encrypted: string;
}

export enum ParseError {
    NoSuchFile = "NoSuchFile",
    FileIsNotDoc = "FileIsNotDoc",
    BadDocumentFormat = "BadDocumentFormat",
    BadPassword = "BadPassword",
    BadAccessToken = "BadAccessToken",
    NoUser = 'NoUser',
    UnknownError = 'UnknownError'
}

export type ParseResponse = 
    {successful: true; data: AppData;} |
    {successful: false; code: ParseError; details: string;};

export function validateDocumentAppState(fileContents: string) {
    const parsed: DocumentAppState = JSON.parse(fileContents);
    if (typeof parsed.revision !== 'string') throw new Error("Bad file contents. 'revision' is not string");
    if (typeof parsed.encrypted !== 'string') throw new Error("Bad file contents. 'encrypted' is not string");
    if (!Array.isArray(parsed.salt) || parsed.salt.length !== 2 || typeof parsed.salt[0] !== 'string' || typeof parsed.salt[1] !== 'string') {
        throw new Error("Bad file contents. 'salt' is not a string array of length 2");
    }
    return parsed;
}

export async function getAppData(signInData: SignInData): Promise<ParseResponse> {
    const {password, googleUser, databaseFileId} = signInData;
    if (password === undefined) return {successful: false, code: ParseError.BadPassword, details: 'no password entered'};
    if (googleUser === undefined) return {successful: false, code: ParseError.NoUser, details: 'no user signed in'};
    if (databaseFileId === undefined) return {successful: false, code: ParseError.NoSuchFile, details: 'no file selected'};
    const contentsResponse = await getFileContents(databaseFileId, googleUser.accessToken);
    if (contentsResponse.type === 'error') {
        switch (contentsResponse.code) {
            case GetFileErrorCode.NoSuchFile:
                return {successful: false, code: ParseError.NoSuchFile, details: contentsResponse.message};
            default:
                return {successful: false, code: ParseError.UnknownError, details: contentsResponse.message};
        }
    }
    const {contents} = contentsResponse;
    let parsed: DocumentAppState | undefined = undefined;
    try {
        parsed = validateDocumentAppState(contents);
    } catch (e) {
        const error = e as Error;
        return {successful: false, code: ParseError.BadDocumentFormat, details: error.message};
    }
    const { salt: [ keySalt, ivSalt ], revision, encrypted } = parsed;
    let decrypted: EncryptedContent | undefined = undefined;
    const BAD_PASSWORD_ERROR: ParseResponse = {successful: false, code: ParseError.BadPassword,
        details: 'Failed to decrypt. Either due to bad password or corrupted file'};
    try {
        const decryptedString = decrypt(encrypted, password, keySalt, ivSalt);
        decrypted = JSON.parse(decryptedString) as EncryptedContent;
    } catch(e) {
        console.log("failed to decrypt", e);
        return BAD_PASSWORD_ERROR;
    }
    const { salts: [decrypedKeySalt, decrypedIvSalt], appState } = decrypted;
    if (decrypedIvSalt !== ivSalt || decrypedKeySalt !== keySalt) {
        console.log("salts mismatch", decrypedIvSalt, ivSalt, decrypedKeySalt, keySalt);
        return BAD_PASSWORD_ERROR;
    }
    return {
        successful: true,
        data: {
            revision,
            data: appState
        }
    };
}