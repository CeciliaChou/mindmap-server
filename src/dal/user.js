import DataLoader from 'dataloader';
import fetch from 'node-fetch';

async function getUserInfoRaw(token, userId) {
    const headers = new fetch.Headers();
    headers.append('Authorization', `Bearer ${token}`);
    const url = `https://api.github.com/user${userId ? `/${userId}` : ''}`;
    return fetch(url, {
        headers,
    }).then(res => {
        if (!res.ok) {
            res.json().then(json => console.log('not authorized', json));
            throw 'Not authorized';
        }
        return res.json()
    }).then(({id, ...rest}) => ({
        id: id.toString(),
        ...rest,
    }))
}

const dataLoader = new DataLoader((keys) => {
    return Promise.all(keys.map(({token, userId}) => getUserInfoRaw(token, userId)))
});

export async function getUserInfo(token, userId)
    : { login: string, id: string, avatar_url: string } {
    return dataLoader.load({token, userId})
}
