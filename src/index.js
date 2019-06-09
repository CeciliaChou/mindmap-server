import "@babel/polyfill";

import {ApolloServer} from "apollo-server-express";
import config from "./graphql/graphql";
import express from "express";
import http from 'http';
import {getToken, getTokenCredentials} from "./oauth2/github";
import cors from 'cors';
import {corsOrigin} from "./config";
import bodyParser from "body-parser";


const PORT = 4000;
const app = express();

app.use(cors());
app.use(bodyParser.json());

app.post('/auth/github', async (req, res) => {
    const {authorizationData: {redirect_uri, scope}, oauthData: {code}} = req.body;
    console.log(redirect_uri, scope, code);
    res.send(await getToken({
        redirectUri: redirect_uri,
        scope,
        code,
    }))
});

app.post('/auth/github_credentials', async (req, res) => {
    return getTokenCredentials(req.headers.authorization)
        .then(token => res.send({token}))
        .catch(() => {
            res.status(403);

            res.send();
        })
});

const {getSchema, ...rest} = config;

getSchema().then(schema => {
    const server = new ApolloServer({
        schema,
        ...rest,
    });
    server.applyMiddleware({app});

    const httpServer = http.createServer(app);
    server.installSubscriptionHandlers(httpServer);

    httpServer.listen(PORT, () => {
        console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
        console.log(`🚀 Subscriptions ready at ws://localhost:${PORT}${server.subscriptionsPath}`)
    });
});
