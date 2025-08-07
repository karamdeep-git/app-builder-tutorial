export interface OauthParams {
    url: string;
    consumerKey: string;
    consumerSecret: string;
    accessToken: string;
    accessTokenSecret: string;
    storeCode?: string;
    version?: string;
}

export interface ImsParams {
    url: string;
    clientId: string;
    clientSecret: string;
    scopes: string[];
    storeCode?: string;
    version?: string;
}

export interface RequestData {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
}
