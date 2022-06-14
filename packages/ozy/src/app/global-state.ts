import React from "react";
import { Schedule } from './schedule';
import { Taxes } from './taxes';
import { Trades } from './trades';
import { YieldFarming } from './yield-farming';
import { Budget } from './budget';
import create from 'zustand';
import { useStoreSelector } from './utils/zustand';
import { AppData, getAppData, ParseError, ParseResponse, SubApp } from "./app-data";
import uuid from 'uuid';
import { clearAccessToken, clearFileId } from "./sign-in/google-accessor";

export type PageInfo = {
    linkLabel: string;
    path: string;
    render: React.FC;
}

export const HOME_PATH = '/';
export const SIGN_IN_PATH = '/sign-in';
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

export type AppState = {
    parseResponseCode: ParseError | undefined;
    refreshing: string | undefined;
    saving: string | undefined;
    signOut: () => void;
    signIn: (keyPassword: string) => void;
    save: () => Promise<void>;
    appData?: AppData
}

export enum SaveError {
    InvalidFileId = "InvalidFileId",
    InvalidAccessToken = "InvalidAccessToken",
    APIError = "APIError"
}

export const useStore = create<AppState>((set, get) => {
    let interval: number | undefined = undefined;
    let minSaveTime = Date.now(); // Every time some local state update occurs, we move this to now + 5 seconds.
    let lastSynced = "";
    setInterval(() => {
        if (Date.now() < minSaveTime) {
            
        }
    }, 5000);
    return {
        appData: undefined,
        parseResponseCode: undefined,
        saving: undefined,
        refreshing: undefined,
        signIn: (keyPassword: string) => {
            function handleResponse(parseResponse: ParseResponse) {
                if (parseResponse.successful) {
                    set({appData: parseResponse.data});
                } else {
                    console.log("Problem parsing. Code", parseResponse.code, "message", parseResponse.details);
                    if (interval !== undefined) {
                        clearInterval(interval);
                        interval = undefined;
                    }
                    set({refreshing: undefined, parseResponseCode: parseResponse.code});
                }
            }
            return;
            getAppData(keyPassword).then(response => {
                handleResponse(response);
                if (response.successful) {
                    interval = window.setInterval(async () => {
                        if (interval === undefined) return;
                        const { appData, refreshing } = get();
                        if (refreshing !== undefined || appData === undefined) return;
                        const refreshId = uuid.v4();
                        set({refreshing: refreshId});
                        const response = await getAppData(keyPassword);
                        const { appData: latestAppData, refreshing: latestRefreshing } = get();
                        if (latestRefreshing !== refreshId) return;
                        if (latestRefreshing === refreshId) {
                            set({refreshing: undefined});
                        }
                        if (latestAppData === undefined) return;
                        handleResponse(response);
                    }, 5000);
                }
            });
        },
        signOut: () => {
            if (interval !== undefined) {
                clearInterval(interval);
                interval = undefined;
            }
            clearFileId();
            clearAccessToken();
            set({appData: undefined, refreshing: undefined});
        },
        save: async () => {

        }
    };
});

export const useAppState = () => useStoreSelector(useStore);