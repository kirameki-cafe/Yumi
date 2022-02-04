import fs from "fs";
import path from "path";

import Logger from "../libs/Logger";

class Configuration {

    public init(): void {
        const dir = path.join(process.cwd(), 'configs/');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        this.copyExampleIfNotExists("Ping.json");
        this.copyExampleIfNotExists("ServiceAnnouncement.json");
    }

    private copyExampleIfNotExists(file: string): void {
        const dir = path.join(process.cwd(), 'configs/');
        if (!fs.existsSync(path.join(dir, file))) {
            fs.copyFileSync(path.join(process.cwd(), 'configs/', `${file.replace('.json', '.example.json')}`), path.join(dir, file));
        }
    }

    // TODO: Make a real providers like Environment

}

export default new Configuration();
