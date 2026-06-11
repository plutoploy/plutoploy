const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function run() {
    const imageName = 'ghcr.io/hareshkhan01/test-node2:latest';
    try {
        const { stdout } = await execAsync(`podman image inspect ${imageName} --format '{{json .Config.ExposedPorts}}'`);
        const ports = JSON.parse(stdout.trim() || '{}');
        let exposedPort = 80;
        if (ports) {
            const portKeys = Object.keys(ports);
            if (portKeys.length > 0) {
                const firstPort = portKeys[0].split('/')[0];
                exposedPort = parseInt(firstPort, 10);
            }
        }
        console.log("Exposed Port:", exposedPort);
    } catch (e) {
        console.error(e);
    }
}
run();
