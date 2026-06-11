import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Pull image using Podman CLI
 */
export const pullImage = async (imageName: string): Promise<void> => {
    if (!imageName) return;
    
    console.log(`Pulling image via Podman CLI: ${imageName}`);
    
    try {
        const { stdout, stderr } = await execAsync(`podman pull ${imageName}`);
        if (stderr && !stderr.includes('Trying to pull')) {
            console.error('Pull stderr:', stderr);
        }
        console.log('Image pulled successfully');
    } catch (error: any) {
        console.error('Failed to pull image:', error.message);
        throw new Error(`Failed to pull image: ${error.message}`);
    }
};

/**
 * Create and start container using Podman CLI
 */
export const createAndStartContainer = async (
    port: number,
    imageName: string,
    deployId: string
): Promise<string> => {
    const containerName = `deploy-${deployId}`;

    console.log(`Creating container: ${containerName}`);

    try {
        let exposedPort = 80;

        try {
            const { stdout } = await execAsync(
                `podman image inspect ${imageName} --format '{{json .Config.ExposedPorts}}'`
            );

            const ports: Record<string, unknown> = JSON.parse(
                stdout.trim() || '{}'
            );

            const portKeys = Object.keys(ports);

            if (portKeys.length > 0) {
                const firstKey = portKeys[0];

                if (firstKey) {
                    const splitParts = firstKey.split('/');
                    const portString = splitParts[0];

                    if (portString) {
                        const parsedPort = Number.parseInt(portString, 10);

                        if (!Number.isNaN(parsedPort)) {
                            exposedPort = parsedPort;
                        }
                    }
                }

                console.log(
                    `Detected exposed port from image: ${exposedPort}`
                );
            } else {
                console.log(
                    'No exposed port detected, defaulting to 80'
                );
            }
        } catch (e: any) {
            console.log(
                `Could not determine exposed port for ${imageName}, defaulting to 80. Error: ${e.message}`
            );
        }

        console.log(
            `Mapping host port ${port} to container port ${exposedPort}`
        );

        const { stdout } = await execAsync(`
            podman run -d \
            --name ${containerName} \
            -p ${port}:${exposedPort} \
            --memory=512m \
            --pids-limit=100 \
            --restart=unless-stopped \
            ${imageName}
        `);

        const containerId = stdout.trim();

        console.log(`Container created: ${containerId}`);

        return containerId;
    } catch (error: any) {
        console.error(
            'Failed to create container:',
            error.message
        );

        throw new Error(
            `Failed to create container: ${error.message}`
        );
    }
};

/**
 * Stop container using Podman CLI
 */
export const stopContainer = async (deployId: string): Promise<void> => {
    const containerName = `deploy-${deployId}`;
    
    try {
        await execAsync(`podman stop ${containerName}`);
        console.log(`Container stopped: ${containerName}`);
    } catch (error: any) {
        console.error('Failed to stop container:', error.message);
        throw error;
    }
};

/**
 * Remove container using Podman CLI
 */
export const removeContainer = async (deployId: string): Promise<void> => {
    const containerName = `deploy-${deployId}`;
    
    try {
        await execAsync(`podman rm -f ${containerName}`);
        console.log(`Container removed: ${containerName}`);
    } catch (error: any) {
        console.error('Failed to remove container:', error.message);
        throw error;
    }
};

/**
 * Get container logs using Podman CLI
 */
export const getContainerLogs = async (deployId: string, tail: number = 100): Promise<string> => {
    const containerName = `deploy-${deployId}`;
    
    try {
        const { stdout } = await execAsync(`podman logs --tail ${tail} ${containerName}`);
        return stdout;
    } catch (error: any) {
        console.error('Failed to get logs:', error.message);
        throw error;
    }
};

/**
 * Check if container is running using Podman CLI
 */
export const isContainerRunning = async (deployId: string): Promise<boolean> => {
    const containerName = `deploy-${deployId}`;
    
    try {
        const { stdout } = await execAsync(`podman ps --filter name=${containerName} --format "{{.Names}}"`);
        return stdout.trim() === containerName;
    } catch (error) {
        return false;
    }
};
