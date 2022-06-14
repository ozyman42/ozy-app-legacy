import SshPK, { PrivateKey } from "sshpk";
import { getBlankScheduleState, ScheduleState } from "../schedule/state";
//import crypto from 'crypto-js';
import * as crypto from 'crypto';
import { hash } from "../utils/crypto";

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
    version: 1;
    key: {
        encrypted: string;
        decrypted: PrivateKey;
    };
    fileId: string;
    latestSyncedHash: string;
    updateInstance: string | undefined; // uuid if updated, undefined if no update
    data: SubAppStateTypes;
};

export type SubAppStateTypes = {
    [SubApp.Schedule]: ScheduleState;
    [SubApp.Taxes]: {version: 1;};
    [SubApp.Trading]: {version: 1;};
    [SubApp.YieldFarming]: {version: 1;};
    [SubApp.Budgeting]: {version: 1;};
}

export function generateBlankDocumentAppState(key: PrivateKey, keyfile: string) {
    return generateDocumentAppState({
        [SubApp.Schedule]: getBlankScheduleState(),
        [SubApp.Taxes]: {version: 1},
        [SubApp.Trading]: {version: 1},
        [SubApp.YieldFarming]: {version: 1},
        [SubApp.Budgeting]: {version: 1},
    }, key, keyfile);
}

export function generateDocumentAppState(appState: SubAppStateTypes, key: PrivateKey, keyfile: string): DocumentAppState {
    //const encrypted = JSON.stringify(appState); key.toPublic().
    const pubKey = key.toPublic().toString("pem");
    console.log("pubkey");
    console.log(pubKey);
    const result = crypto.publicEncrypt(pubKey, Buffer.from("hello world")).toString('base64');
    console.log("result below");
    console.log(result);
    const encrypted = "";
    return {
        version: 1,
        key: {
            hash: hash(keyfile),
            encrypted: keyfile
        },
        state: {
            hash: hash(encrypted),
            encrypted
        }
    }
}

export type AppData = DeserializedAppData<SubAppStateTypes>;

export type DocumentAppState = {
    version: number;
    key: {
        hash: string;
        encrypted: string;
    };
    state: {
        hash: string;
        encrypted: string;
    };
}

export enum ParseError {
    NoSuchFile = "NoSuchFile",
    FileIsNotDoc = "FileIsNotDoc",
    BadDocumentFormat = "BadDocumentFormat",
    BadPassword = "BadPassword",
    BadAccessToken = "BadAccessToken",
}

export type ParseResponse = 
    {successful: true; data: AppData;} |
    {successful: false; code: ParseError; details: string;};

export function validateDocumentAppState(fileContents: string) {
    const parsed = JSON.parse(fileContents);
    if (typeof parsed.version !== 'number') throw new Error("Bad file contents. 'version' is not number");
    if (typeof parsed.key !== 'object') throw new Error("Bad file contents. 'key' is not object");
    if (typeof parsed.key.hash !== 'string') throw new Error("Bad file contents. 'key.hash' is not string");
    if (typeof parsed.key.encrypted !== 'string') throw new Error("Bad file contents. 'key.encrypted' is not string");
    if (typeof parsed.state !== 'object') throw new Error("Bad file contents. 'state' is not object");
    if (typeof parsed.state.hash !== 'string') throw new Error("Bad file contents. 'state.hash' is not string");
    if (typeof parsed.state.encrypted !== 'string') throw new Error("Bad file contents. 'state.encrypted' is not string");
    return parsed as DocumentAppState;
}

export async function getAppData(keyPassword: string): Promise<ParseResponse> {
    return {successful: false, code: ParseError.BadAccessToken, details: 'not implemented'};
}