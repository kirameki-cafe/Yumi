import { Api } from 'node-osu';
import Environment from './Environment';

class osu {

    public client: Api;

    constructor () {
        this.client = new Api(Environment.get().OSU_API_KEY, {
            notFoundAsError: false,
            completeScores: true,
            parseNumeric: true
        });
    }

    public init(): void {

    }

    public end(): void {
    }

}

export default new osu();