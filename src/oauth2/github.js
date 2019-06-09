import oauth2 from 'simple-oauth2';
import fetch from 'node-fetch';
import DataLoader from 'dataloader'

const client = {
    id: '3ebc782dbfbb301f45cf',
    secret: 'a5a9bb0f7bd54106c9be36e73178c0e50bc02ea0',
};
const oauth2Util = oauth2.create({
    client,
    auth: {
        tokenHost: 'https://github.com',
        tokenPath: '/login/oauth/access_token',
    }
});

export async function getTokenCredentialsRaw(encodedAuth) {
    const headers = new fetch.Headers();
    headers.append('Authorization', encodedAuth);
    headers.append('Content-Type', 'application/json');
    const body = {
        scope: 'user:email',
        note: 'Weixin MiniProgram login',
        client_id: client.id,
        client_secret: client.secret,
    };
    return fetch('https://api.github.com/authorizations', {
        method: 'POST',
        body: JSON.stringify(body),
        headers,
    })
        .then(data => {
            if (!data.ok) throw 'Not authorized';
            return data.json();
        })
        .then(json => json.token)
}

const dataLoader = new DataLoader(keys => {
    return Promise.all(keys.map(async ({key, ...args}) => {
        if (key === 'getToken')
            return await oauth2Util.authorizationCode.getToken(args);
        else
            return getTokenCredentialsRaw(args.encodedAuth)
    }))
});

export async function getToken({code, redirectUri, scope}) {
    const result = await dataLoader.load({
        key: 'getToken',
        code,
        redirect_uri: redirectUri,
        scope,
    });
    return oauth2Util.accessToken.create(result)
}

export async function getTokenCredentials(encodedAuth) {
    return dataLoader.load({key: 'getTokenCredentials', encodedAuth,})
}
