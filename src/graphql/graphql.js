import {gql} from 'apollo-server/dist/index'
import {MindmapPubSub} from "../pub-sub/mindmap-pub-sub";
import {getMindmapById, addToMindmap, createMindmap, listMindmapsByUser, searchMindmaps} from "../dal/mindmap-meta";
import {markAsRead, getAllNotifications} from "../dal/notification";
import {associateNodeWithLabel, disassociateNodeWithLabel, getNodeAssociatedLabels} from "../dal/mindmap-node-labels";
import {getUserInfo} from "../dal/user";
import {getSubscribedLabels, subscribeToLabel, unsubscribeToLabel} from "../dal/user-prefs";
import {NotificationPubSub} from "../pub-sub/notification-pub-sub";
import {getLabelsSchema} from "./labels-graphql";
import mergeSchemas from "graphql-tools/dist/stitching/mergeSchemas";
import {RedisCache} from "apollo-server-cache-redis/dist/index";
import {redisUrl} from "../config";

const mindmapPubSub = new MindmapPubSub();
const notificationPubSub = new NotificationPubSub();

const DEFAULT_LIMIT = 10;

const typeDefs = gql`
    type Query {
        me: User
        searchMindmaps(text: String!, limit: Int, cursor: String): MindmapConnection
        listNotifications(limit: Int, cursor: String, unreadFilter: Boolean): NotificationConnection
        getNodeLabels(mindmapId: ID!, path: [String!]!): [Label]
        getSubscribedLabels: [Label]
    }

    type Mutation {
        attach(id: ID!, path: [ID!]!): Boolean
        delete(id: ID!, path: [ID!]!, oldName: String!): Boolean
        rename(id: ID!, path: [ID!]!, oldName: String!, newName: String!): Boolean

        createMindmap(name: String!): Mindmap
        collaborateInMindmap(userId: ID!, mindmapId: ID!): Mindmap

        applyToCollaborateIn(mindmapId: ID!): Boolean
        markNotificationAsRead(id: ID): Boolean

        associateNodeWithLabel(mindmapId: ID!, path: [String!]!, labelId: ID!): Label
        disassociateNodeWithLabel(mindmapId: ID!, path: [String!]!, labelId: ID!): Label

        subscribeToLabel(labelId: ID!): Label
        unsubscribeToLabel(labelId: ID!): Label
    }

    type Subscription {
        subscribe(id: ID!): MindmapEvent
        newNotification: Notification
    }

    union MindmapEvent = Doc | Modification | MindmapLabelEvent

    type Doc {
        json: String
    }

    enum Action {
        ATTACH
        DELETE
        RENAME
    }

    type Modification {
        path: [String]
        action: Action
        value: String
    }

    enum LabelAction {
        ASSOCIATE
        DISASSOCIATE
    }

    type MindmapLabelEvent {
        path: [String]
        action: LabelAction
        value: Label
    }

    type Mindmap {
        id: ID
        name: String
        userRoles: [UserRole]
        owner: User
    }

    enum Role {
        OWNER
        COLLABORATOR
    }

    type UserRole {
        user: User
        role: Role
    }

    type User {
        id: ID
        login: String
        avatarUrl: String
        mindmaps(limit: Int, cursor: String, roleFilter: [Role!]): MindmapConnection
    }

    type MindmapConnection {
        items: [Mindmap]
        nextCursor: String
    }

    type Notification {
        id: ID
        content: String
        isRead: Boolean
        meta: String
    }

    type NotificationConnection {
        items: [Notification]
        nextCursor: String
    }
`;

let labelsSchema;

async function getSchema() {
    labelsSchema = await getLabelsSchema();
    return mergeSchemas({
        schemas: [
            labelsSchema,
            typeDefs,
        ],
        resolvers,
    })
}

function requireValidMindmapId(id) {
    return getMindmapById(id)
        .catch(err => {
            console.log('mindmapId failed', err);
            throw 'The mindmap with this id is not yet created';
        });
}

function getDelegatedLabel(labelId, context, info) {
    return info.mergeInfo.delegateToSchema({
        schema: labelsSchema,
        operation: 'query',
        fieldName: 'getLabel',
        args: {
            id: labelId,
        },
        context,
        info,
    });
}

// noinspection JSUnusedGlobalSymbols
const resolvers = {
    Query: {
        me: (root, args, {user}) => user,
        async searchMindmaps(root, {text, limit, cursor}) {
            limit = limit || DEFAULT_LIMIT;
            return searchMindmaps(text, limit, cursor)
        },
        async listNotifications(root, {limit, cursor, unreadFilter}, {user: {id: userId}}) {
            limit = limit || DEFAULT_LIMIT;
            if (unreadFilter === null) unreadFilter = true;
            return getAllNotifications(userId, limit, cursor)
        },
        async getNodeLabels(root, {mindmapId, path}, context, info) {
            const labels = await getNodeAssociatedLabels(mindmapId, path);
            return labels.map(labelId => getDelegatedLabel(labelId, context, info))
        },
        async getSubscribedLabels(root, args, context, info) {
            const {user: {id}} = context;
            const labels = await getSubscribedLabels(id);
            return labels.map(labelId => getDelegatedLabel(labelId, context, info))
        },
    },
    Mutation: {
        async attach(root, args) {
            await requireValidMindmapId(args.id);
            mindmapPubSub.publish(args.id, {type: 'attachNewNode', args: [args.path]});
            return true
        },
        async delete(root, args) {
            await requireValidMindmapId(args.id);
            mindmapPubSub.publish(args.id, {type: 'deleteNode', args: [args.path, args.oldName]});
            return true
        },
        async rename(root, args) {
            await requireValidMindmapId(args.id);
            mindmapPubSub.publish(args.id, {type: 'renameNode', args: [args.path, args.oldName, args.newName]});
            return true
        },
        async createMindmap(root, {name}, {user: {id: userId}}) {
            return createMindmap(name, userId)
        },
        async collaborateInMindmap(root, {userId, mindmapId}) {
            const result = await addToMindmap(mindmapId, userId);
            notificationPubSub.approveApplication(mindmapId, userId);
            return result
        },
        async applyToCollaborateIn(root, {mindmapId}, {user: {id: userId}}) {
            notificationPubSub.applyToCollaborate(mindmapId, userId);
            return true
        },
        async markNotificationAsRead(root, {id}, {user: {id: userId}}) {
            await markAsRead(userId, id);
            return true
        },
        async associateNodeWithLabel(root, {mindmapId, path, labelId}, context, info) {
            await requireValidMindmapId(mindmapId);
            await associateNodeWithLabel(mindmapId, path, labelId);
            mindmapPubSub.publish(mindmapId, {
                type: 'label',
                args: {
                    path,
                    labelId,
                    action: 'associate',
                }
            });
            return getDelegatedLabel(labelId, context, info)
        },
        async disassociateNodeWithLabel(root, {mindmapId, path, labelId}, context, info) {
            await requireValidMindmapId(mindmapId);
            const label = await disassociateNodeWithLabel(mindmapId, path, labelId);
            if (label.length) {
                mindmapPubSub.publish(mindmapId, {
                    type: 'label',
                    args: {
                        path,
                        labelId,
                        action: 'disassociate',
                    }
                });
                return getDelegatedLabel(label[0], context, info)
            } else {
                return null
            }
        },
        async subscribeToLabel(root, {labelId}, context, info) {
            const {user: {id}} = context;
            await subscribeToLabel(id, labelId);
            return getDelegatedLabel(labelId, context, info)
        },
        async unsubscribeToLabel(root, {labelId}, context, info) {
            const {user: {id}} = context;
            const label = await unsubscribeToLabel(id, labelId);
            return label.length ? getDelegatedLabel(labelId, context, info) : null
        }
    },
    Subscription: {
        subscribe: {
            subscribe: async (root, args) => {
                await requireValidMindmapId(args.id);
                return mindmapPubSub.asyncIterator(args.id);
            }
        },
        newNotification: {
            subscribe: (root, args, {user: {id}}) => {
                console.log('newNotification', root, args, id);
                return notificationPubSub.asyncIterator(id)
            }
        }
    },
    MindmapEvent: {
        __resolveType(source) {
            return source.__typename
        }
    },
    Doc: {
        json(source) {
            return JSON.stringify(source.root)
        }
    },
    MindmapLabelEvent: {
        value({labelId}, args, context, info) {
            return getDelegatedLabel(labelId, context, info)
        }
    },
    Mindmap: {
        id: ({_id}) => _id,
        userRoles: ({users}) => users,
        owner: ({owner}) => ({id: owner}),
    },
    UserRole: {
        user: ({id}) => ({id}),
        role: ({role}) => role.toUpperCase(),
    },
    User: {
        async login({id, login}, args, {token}) {
            return login || (await getUserInfo(token, id)).login
        },
        async avatarUrl({id, avatarUrl}, args, {token}) {
            return avatarUrl || (await getUserInfo(token, id)).avatar_url
        },
        async mindmaps({id}, {cursor, limit, roleFilter}) {
            limit = limit || DEFAULT_LIMIT;
            const roles = roleFilter && roleFilter.map(r => r.toLowerCase())
                || ['owner', 'collaborator'];
            return listMindmapsByUser(id, limit, cursor, roles)
        }
    },

};

async function authenticateUser(token) {
    const user = await getUserInfo(token);
    console.log('authenticated user as', user.id);
    return {
        user: {
            avatarUrl: user.avatar_url,
            ...user,
        },
        token,
    }
}

// noinspection JSUnusedGlobalSymbols
const subscriptionAuth = {
    onConnect: (params) =>
        // ({user: {id: 'exampleUser'}})
        authenticateUser(params.authToken)
            .catch((err) => {
                const id = params['user-id'];
                console.log('auth failed, using fallback instead:', id);
                return {user: {id}};
            })
};

const context = (ctx) => {
    // return ({user: {id: 'exampleUser'}});
    console.log('ctx is', ctx);
    const user = ctx.req ? authenticateUser(ctx.req.headers.authorization?.split(' ')[1])
            .catch((err) => {
                const id = ctx.req.headers['user-id'];
                console.log('auth failed, using fallback instead:', id);
                return {user: {id}};
            })
        : ctx.connection.context;
    console.log('user for context is', user);
    return user
};

// noinspection JSUnusedGlobalSymbols
export default {
    getSchema,
    subscriptions: subscriptionAuth,
    context,
    cache: new RedisCache({
        host: redisUrl,
    }),
    formatError: error => {
        console.log(error);
        return error;
    },
    formatResponse: response => {
        console.log(response);
        return response;
    },
}
