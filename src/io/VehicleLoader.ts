import fs from 'fs';
import { IVehicleConfig } from '../core/interfaces';

export class VehicleLoader {
    /**
     * Load vehicle configuration from JSON file
     * @param path Absolute or relative path to config file
     */
    static load(path: string): IVehicleConfig {
        if (!fs.existsSync(path)) {
            throw new Error(`Config file not found at: ${path}`);
        }
        const data = fs.readFileSync(path, 'utf-8');
        try {
            const config = JSON.parse(data);
            // Basic validation could go here
            return config as IVehicleConfig;
        } catch (e) {
            throw new Error(`Failed to parse config: ${e}`);
        }
    }
}
