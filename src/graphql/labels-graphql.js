import fetch from 'fetch-retry';
import {introspectSchema, makeRemoteExecutableSchema} from "graphql-tools/dist/index";
import {print} from 'graphql'
import aws4 from 'aws4'

const fetcher = async ({ query: queryDocument, variables, operationName, context }) => {
    const query = print(queryDocument);
    console.log('context is', context);
    const host = `ntnmdlhlazg3rpktqhsi5uyzja.appsync-api.us-west-2.amazonaws.com`;
    const path = `/graphql`;
    const headers = {
        'Content-Type': 'application/json',
    };
    if (context) headers['x-user-id'] = context?.graphqlContext?.user?.id;
    const req = {
        host,
        path,
        service: 'appsync',
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables, operationName }),
        retryOn: [443],
    };
    const signedReq = aws4.sign(req, {
        secretAccessKey: "kd7ipBTLHJM4hPZhLF6IkdMHNcXUCbOufoxY1EWt",
        accessKeyId: "AKIAIDUHRY6AAFEYSQ3A",
    });
    const fetchResult = await fetch(`https://${host}${path}`, signedReq);
    const jsonResult = await fetchResult.json();
    console.log('fetched result', jsonResult);
    return jsonResult;
};

export async function getLabelsSchema() {
    const schema = await introspectSchema(fetcher);

    return makeRemoteExecutableSchema({
        schema,
        fetcher,
    })
}
