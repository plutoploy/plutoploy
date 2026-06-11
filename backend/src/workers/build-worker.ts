import { exec } from "child_process";
import { log } from "console";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);
const repoUrl = `https://github.com/Debzoti/react-jobs.git`

async function buildWorker(repoUrl: string): Promise<void> {
    console.log("Build worker started");

    const buildId = Date.now();
    const buildDir = `/tmp/builds/${buildId}`;
    const deployDir = `/var/www/apps/${buildId}`;

    try {
       //spin up a docker conatainer pull inside container
       

    } catch (error : any) {
        console.error("build failed", error.message)
    }

}


buildWorker(repoUrl)
    .then(() => {
        console.log("Build worker completed");
    })
    .catch((error : any) => {
        console.error("build failed", error.message)
    });