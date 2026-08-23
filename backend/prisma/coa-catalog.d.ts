export type CoaAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type CoaNormalBalance = 'DEBIT' | 'CREDIT';
export type CoaDef = {
    code: string;
    nameAr: string;
    nameEn: string;
    type: CoaAccountType;
    parentCode?: string;
    isPostable: boolean;
    isContra?: boolean;
    normalBalance?: CoaNormalBalance;
};
export declare const STANDARD_COA: CoaDef[];
export declare function coaLevel(code: string): number;
