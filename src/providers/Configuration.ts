import fs from "fs";
import path from "path";

import Logger from "../libs/Logger";

class Configuration {

    public init(): void {
        const dir = path.join(process.cwd(), 'configs/');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
    }

    // TODO: Make a real providers like Environment

}

export default new Configuration();
