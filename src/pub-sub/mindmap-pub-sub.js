import {PubSub} from "graphql-subscriptions/dist/index";
import {MindmapGraphqlAdapter} from "./mindmap-graphql-adapter";

export class MindmapPubSub extends PubSub {
    constructor() {
        super({eventEmitter: new MindmapGraphqlAdapter()});
    }

    publish(mindmapName: string, payload: any): Promise<void> {
        if (payload.type === 'label')
            return super.publish(mindmapName, {
                subscribe: {
                    __typename: 'MindmapLabelEvent',
                    path: payload.args.path,
                    action: payload.args.action.toUpperCase(),
                    labelId: payload.args.labelId,
                }
            });
        return this.ee.modify(mindmapName, payload.type, ...payload.args)
    }

    asyncIterator(triggers: string | string[]): AsyncIterator<T> {
        return super.asyncIterator(triggers);
    }
}