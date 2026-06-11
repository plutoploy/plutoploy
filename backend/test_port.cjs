const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function run() {
    const imageName = 'ghcr.io/hareshkhan01/test-node2:latest';
    let exposedPort = 80;
    try {
        const { stdout } = await execAsync(`podman image inspect ${imageName} --format '{{json .Config.ExposedPorts}}'`);
        console.log("Stdout:", stdout);
        const ports = JSON.parse(stdout.trim() || '{}');
        if (ports && Object.keys(ports).length > 0) {
            const firstPort = Object.keys(ports)[0].split('/')[0];
            if (!isNaN(parseInt(firstPort, 10))) {
                exposedPort = parseInt(firstPort, 10);
            }
            console.log(`Detected exposed port from image: ${exposedPort}`);
        } else {
            console.log(`No exposed port detected, defaulting to 80`);
        }
    } catch (e) {
        console.log(`Could not determine exposed port for ${imageName}, defaulting to 80. Error: ${e.message}`);
    }
}
run();
