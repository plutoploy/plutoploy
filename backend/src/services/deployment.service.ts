import { pullImage, createAndStartContainer } from '../handlers/podman-cli.handler';
import { addCaddyRoute } from '../handlers/caddy.handler';
import type { DeploymentConfig } from '../types/config';

/**
 * Main deployment orchestration service
 */
export const deployApp = async (config: DeploymentConfig) => {
    const { deployId, subdomain, port, imageName } = config;

    try {
        console.log(`Starting deployment ${deployId}...`);

        // 1. Pull image from registry
        console.log(`Pulling image: ${imageName}`);
        await pullImage(imageName);

        // 2. Create and start container
        console.log(`Creating container on port ${port}`);
        const containerId = await createAndStartContainer(port, imageName, deployId);

        // 3. Add Caddy route via SQLite
        console.log(`Adding Caddy route for ${subdomain}...`);
        await addCaddyRoute(deployId, subdomain, port);

        console.log(`✅ Deployment ${deployId} successful!`);

        return {
            success: true,
            deployId,
            subdomain,
            port,
            url: `https://${subdomain}.${process.env.DOMAIN || 'yourdomain.com'}`,
            containerId
        };

    } catch (error: any) {
        console.error(`❌ Deployment ${deployId} failed:`, error.message);
        throw error;
    }
};
