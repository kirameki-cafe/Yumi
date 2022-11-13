import { Api } from 'node-osu';
import Environment from './Environment';

class osuAPI {
    public client: Api | null;

    constructor() {
        this.client = null;
    }

    public init(): void {
        this.client = new Api(Environment.get().OSU_API_KEY, {
            notFoundAsError: false,
            completeScores: true,
            parseNumeric: true
        });
    }

    public end(): void {}
}

export default new osuAPI();
