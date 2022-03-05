import fs from "fs";
import path from "path";

const ConfigurationData: any = [];
class Configuration {

    public init(): void {
        const dir = path.join(process.cwd(), 'configs/');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        this.copyExampleIfNotExists("Ping.json");
        this.copyExampleIfNotExists("ServiceAnnouncement.json");

        this.loadConfig("Ping.json");
        this.loadConfig("ServiceAnnouncement.json");
    }

    public loadConfig(configFileName: string): void {
        const dir = path.join(process.cwd(), 'configs/');
        if (!fs.existsSync(path.join(dir, configFileName))) 
            throw new Error(`Config file ${configFileName} does not exist`);

        const config = JSON.parse(fs.readFileSync(path.join(dir, configFileName)).toString());
        ConfigurationData[configFileName.replace(/\.[^/.]+$/, "")] = config;
    }

    public getConfig(key?: string) {
        if(!key)
            return ConfigurationData;
        else {
            if(ConfigurationData[key])
                return ConfigurationData[key];
            else
                throw new Error(`No configuration found for ${key}`);
        }
    }

    private copyExampleIfNotExists(file: string): void {
        const dir = path.join(process.cwd(), 'configs/');
        if (!fs.existsSync(path.join(dir, file))) {
            fs.copyFileSync(path.join(process.cwd(), 'configs_example/', `${file.replace('.json', '.example.json')}`), path.join(dir, file));
        }
    }

}

export default new Configuration();
