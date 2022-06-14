export type ScheduleState = {
    version: 2;
    templates: Record<string, (string | undefined)[][]>, // key = template name. value first index = day. value second index = hour. Value = name of option
    templateRepetition: string[], // repeated order of templates
    optionsByName: Record<string, string>; // key is option name, value is category
    wakeUpAt: number;
    categories: Record<string, string>; // key is category, value is css color
    defaultCategory: string;
}

export const TIME_BLOCK_LENGTH = 15; // 15 minutes

export function getBlankScheduleState(): ScheduleState {
    return {
        version: 2,
        templates: {},
        templateRepetition: [],
        optionsByName: {},
        wakeUpAt: (60 / TIME_BLOCK_LENGTH) * 5, // 5AM
        categories: {
            'Deep Work': 'rgb(0, 255, 255)',
            'Exercise': 'rgb(191, 144, 0)',
            'Education': 'rgb(204, 204, 204)',
            'Contemplation': 'rgb(100, 126, 107)',
            'Maintenance': 'rgb(255, 242, 204)',
            'Social': 'rgb(180, 167, 214)',
            'Trading': 'rgb(0, 255, 0)'
        },
        defaultCategory: 'Deep Work'
    }
}