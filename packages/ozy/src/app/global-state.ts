import React from "react";
import { Schedule } from './schedule';
import { Taxes } from './taxes';
import { Trades } from './trades';
import { YieldFarming } from './yield-farming';
import { Budget } from './budget';
import create from 'zustand';
import { PrivateKey } from 'sshpk';
import { useStoreSelector } from './utils/zustand';

export enum Page {
    Schedule      = 'Schedule',
    Taxes         = 'Taxes',
    Trading       = 'Trading',
    YieldFarming  = 'YieldFarming',
    Budgeting     = 'Budgeting'
}

export type PageInfo = {
    linkLabel: string;
    path: string;
    render: React.FC;
}

export const HOME_PATH = '/';
export const SIGN_IN_PATH = '/sign-in';
export const REDIRECT_QUERY_PARAM = 'redirect';

export const PAGES: {[page in Page]: PageInfo} = {
    [Page.Schedule]: {
        linkLabel: "Schedule",
        path: '/schedule',
        render: Schedule
    },
    [Page.Taxes]: {
        linkLabel: "Taxes",
        path: '/taxes',
        render: Taxes
    },
    [Page.Trading]: {
        linkLabel: "Trades",
        path: '/trades',
        render: Trades
    },
    [Page.YieldFarming]: {
        linkLabel: "Yield Farming",
        path: "/yield-farming",
        render: YieldFarming
    },
    [Page.Budgeting]: {
        linkLabel: "Budget",
        path: '/budget',
        render: Budget
    }
}

export type AppState = {
    signedIn: {
        google?: {
            document: string;
            serializedKey?: string;
        };
        key?: {
            private: PrivateKey;
            password: string;
        };
    };
    signOut: () => void;
    appData: {

    }
}

const useStore = create<AppState>((set, get) => {
    return {
        signedIn: {},
        signOut: () => {
            set({signedIn: {}});
        },
        appData: {}
    };
});

export const useAppState = () => useStoreSelector(useStore);