import React from "react";
import { Schedule } from './schedule';
import { Taxes } from './taxes';
import { Trades } from './trades';
import { YieldFarming } from './yield-farming';
import { Budget } from './budget';
import create from 'zustand';
import { useStoreSelector } from './utils/zustand';
import { AppData, getAppData, ParseError, ParseResponse, SubApp } from "./app-data";
import { clearAccessToken, GoogleUser } from "./sign-in/google-accessor";

export type PageInfo = {
    linkLabel: string;
    path: string;
    render: React.FC;
}

export const HOME_PATH = '/';
export const SIGN_IN_PATH = '/account';
export const REDIRECT_QUERY_PARAM = 'redirect';

export const PAGES: {[app in SubApp]: PageInfo} = {
    [SubApp.Schedule]: {
        linkLabel: "Schedule",
        path: '/schedule',
        render: Schedule
    },
    [SubApp.Taxes]: {
        linkLabel: "Taxes",
        path: '/taxes',
        render: Taxes
    },
    [SubApp.Trading]: {
        linkLabel: "Trades",
        path: '/trades',
        render: Trades
    },
    [SubApp.YieldFarming]: {
        linkLabel: "Yield Farming",
        path: "/yield-farming",
        render: YieldFarming
    },
    [SubApp.Budgeting]: {
        linkLabel: "Budget",
        path: '/budget',
        render: Budget
    }
}

export enum EncryptPasswordMethod {
    Metamask = "Metamask",
    Fingerprint = "Fingerprint"
}

export type SignInData = {
    googleUser: GoogleUser | undefined;
    databaseFileId: string | undefined;
    databaseFileName: string | undefined;
    password: string | undefined;
    encryptPasswordMethod: EncryptPasswordMethod | undefined;
}

export enum SignInError {
    BadPassword = 'BadPassword',
    Other = "Other"
}

export type SignInResult = 
    {success: true} |
    {success: false; code: SignInError; details: string;};

export type AppState = {
    appData?: AppData;
    notifications: {
        id: string;
        closed: boolean;
        expiresAt: number | undefined;
        text: string;
        type: 'error' | 'warning' | 'success' | 'progress'
    }[];
    ingestedRevisions: Record<string, string>; // 
    signInData: SignInData;
    changePassword: (newPassword: string) => Promise<void>;
    signOut: () => void;
    signIn: (data: Partial<SignInData>) => Promise<SignInResult>;
    save: () => Promise<void>;
}

export enum SaveError {
    InvalidFileId = "InvalidFileId",
    InvalidAccessToken = "InvalidAccessToken",
    APIError = "APIError"
}

export function isSignedIn({ googleUser, databaseFileId, password, databaseFileName }: SignInData) {
    return googleUser !== undefined && databaseFileId !== undefined && databaseFileName !== undefined && password !== undefined;
}

const SIGN_OUT_DATA: SignInData = {
    googleUser: undefined,
    databaseFileId: undefined,
    databaseFileName: undefined,
    password: undefined,
    encryptPasswordMethod: undefined
};

function equals(one: SignInData, two: SignInData) {
    return (
        one.databaseFileId === two.databaseFileId &&
        one.databaseFileName === two.databaseFileName &&
        one.encryptPasswordMethod === two.encryptPasswordMethod &&
        one.password === two.password &&
        one.googleUser?.accessToken === two.googleUser?.accessToken
    );
}

export const useStore = create<AppState>((set, get) => {
    let minSaveTime = Date.now(); // Every time some local state update occurs, we move this to now + 5 seconds.
    const globalWindow = (window as any);
    if (globalWindow.interval !== undefined) {
        clearInterval(globalWindow.interval);
    }
    const interval = setInterval(() => {
        if (Date.now() < minSaveTime) {
            
        }
        // First refresh, then if no change, save
    }, 5000);
    globalWindow.interval = interval;
    return {
        appData: undefined,
        notifications: [],
        signInData: SIGN_OUT_DATA,
        ingestedRevisions: {},
        changePassword: async newPassword => {

        },
        signIn: async (signInData) => {
            const existingSignInData = get().signInData;
            const newSignInData: SignInData = {...existingSignInData, ...signInData};
            if (!isSignedIn(newSignInData) || equals(existingSignInData, newSignInData)) {
                set({signInData: newSignInData});
                return {success: true};
            }
            const parsed = await getAppData(newSignInData);
            if (!parsed.successful) {
                switch (parsed.code) {
                    case ParseError.BadPassword:
                        return {success: false, code: SignInError.BadPassword, details: parsed.details};
                    default:
                        console.log("got unexpected parse error");
                        console.log(parsed);
                        return {success: false, code: SignInError.Other, details: parsed.details};
                }
            }
            const newIngested: Record<string, string> = 
                {...get().ingestedRevisions, [parsed.data.revision]: newSignInData.password!};
            set({signInData: newSignInData, appData: parsed.data, ingestedRevisions: newIngested});
            return {success: true};
        },
        signOut: () => {
            console.log("sign out request");
            clearAccessToken();
            set({appData: undefined, signInData: SIGN_OUT_DATA});
        },
        save: async () => {

        }
    };
});

export const useAppState = () => useStoreSelector(useStore);