/**
 * GitHub Routes
 *
 * GET  /api/repos   — List repositories the user gave the GitHub App access to
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { requireAuth } from '../middleware/auth.middleware.ts';
import { authDb, buildsDb } from '../db/database.ts';
import { generateInstallationToken, getInstallationRepos, injectWorkflowToRepo } from '../services/github.service.ts';
import { randomUUID } from 'crypto';
import type { AuthEnv } from '../middleware/auth.middleware.ts';

const githubRoutes = new Hono<AuthEnv>();

/**
 * GET /api/repos
 * Returns the list of repositories the authenticated user has granted
 * the GitHub App access to.
 *
 * Requires: session token (Authorization: Bearer <token> or cookie)
 */
githubRoutes.get('/repos', requireAuth, async (c) => {
    const user = c.get('user');

    // 1. Look up their installation_id
    const installationId = authDb.getUserInstallationId(user.id);

    if (!installationId) {
        return c.json({
            error: 'GitHub App not installed',
            message: 'Please install the Plutoploy GitHub App on your account to grant repo access.',
            install_url: process.env.GITHUB_APP_LINK
                ? `${process.env.GITHUB_APP_LINK}/installations/new`
                : null,
        }, 403);
    }

    try {
        // 2. Generate a short-lived Installation Access Token
        const installationToken = await generateInstallationToken(installationId);

        // 3. Fetch repos via the Installation API
        const repos = await getInstallationRepos(installationToken);

        // Helper to format relative time
        const timeAgo = (dateStr: string) => {
            const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + " years ago";
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + " months ago";
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + " days ago";
            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + " hours ago";
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + " minutes ago";
            return Math.floor(seconds) + " seconds ago";
        };

        // 4. Return the format expected by the frontend
        return c.json({
            repos: repos.map(r => ({
                id: String(r.id),
                projectName: r.name,
                description: r.description, // <-- ADDED THIS
                commitHash: 'N/A',          // Not deployed yet, so no commit hash available here directly
                branch: r.default_branch,
                status: 'success',          // Mocking 'success' for now, can be updated with real deploy status later
                duration: '-',              // Not applicable until deployed
                timestamp: timeAgo(r.updated_at),
                // Keeping some originals just in case
                full_name: r.full_name,
                html_url: r.html_url
            })),
            count: repos.length,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch repositories';
        console.error('[GitHub Routes] /api/repos error:', err);
        return c.json({ error: message }, 500);
    }
});

/**
 * POST /inject-workflow
 * Injects a deployment workflow and necessary docker config into a repository.
 *
 * Body: { repoFullName: string, runtime: 'node' | 'python', branch: string }
 */
githubRoutes.post('/inject-workflow', requireAuth, async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const { repoFullName, runtime, branch } = body;

    if (!repoFullName || !runtime || !branch) {
        return c.json({ error: 'Missing required fields: repoFullName, runtime, branch' }, 400);
    }

    if (runtime !== 'node' && runtime !== 'python') {
        return c.json({ error: 'Invalid runtime. Must be "node" or "python"' }, 400);
    }

    // 1. Look up their installation_id
    const installationId = authDb.getUserInstallationId(user.id);

    if (!installationId) {
        return c.json({ error: 'GitHub App not installed' }, 403);
    }

    try {
        // 2. Generate installation token
        const installationToken = await generateInstallationToken(installationId);

        // 3. Inject workflow
        await injectWorkflowToRepo(repoFullName, runtime as 'node' | 'python', branch, installationToken);

        // 4. Create build record
        const buildId = randomUUID();
        buildsDb.create({
            id: buildId,
            repo: repoFullName,
            branch: branch
        });

        return c.json({ success: true, message: 'Workflow injected successfully', buildId });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to inject workflow';
        console.error('[GitHub Routes] /inject-workflow error:', err);
        return c.json({ error: message }, 500);
    }
});

/**
 * GET /builds/:id/logs
 * Stream GitHub Action build logs to the frontend via SSE.
 */
githubRoutes.get('/builds/:id/logs', requireAuth, async (c) => {
    const user = c.get('user');
    const buildId = c.req.param('id');
    
    const build = buildsDb.getById(buildId) as any;
    if (!build) return c.json({ error: 'Build not found' }, 404);

    const installationId = authDb.getUserInstallationId(user.id);
    if (!installationId) return c.json({ error: 'GitHub App not installed' }, 403);

    const installationToken = await generateInstallationToken(installationId);

    return streamSSE(c, async (stream) => {
        let lastLogLine = 0;
        let isCompleted = false;
        
        // Initial message
        await stream.writeSSE({ data: 'Initializing build process...' });

        while (!isCompleted) {
            const currentBuild = buildsDb.getById(buildId) as any;
            
            if (!currentBuild) {
                await stream.writeSSE({ data: 'Build record lost.' });
                break;
            }

            if (currentBuild.status === 'success' || currentBuild.status === 'failure') {
                isCompleted = true;
            }

            if (!currentBuild.github_run_id) {
                await stream.writeSSE({ data: 'Waiting for GitHub Action to start...' });
                
                try {
                    // Fallback: Check if there's a recent workflow run for this repo
                    const runsRes = await fetch(`https://api.github.com/repos/${build.repo}/actions/runs?per_page=1`, {
                        headers: {
                            Authorization: `Bearer ${installationToken}`,
                            Accept: 'application/vnd.github+json',
                            'User-Agent': 'Plutoploy/1.0',
                        }
                    });
                    if (runsRes.ok) {
                        const runsData = await runsRes.json() as any;
                        if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
                            const latestRun = runsData.workflow_runs[0];
                            // Only attach if it started near or after our build was created
                            const buildTime = new Date(currentBuild.created_at).getTime();
                            const runTime = new Date(latestRun.created_at).getTime();
                            
                            if (runTime >= buildTime - 60000) {
                                buildsDb.updateState(buildId, 'in_progress', String(latestRun.id));
                                currentBuild.github_run_id = String(latestRun.id);
                                await stream.writeSSE({ data: `Found GitHub Action Run: ${latestRun.id}` });
                            }
                        }
                    }
                } catch (e) {
                    console.error('[SSE Logs] Error fetching latest runs:', e);
                }

                if (!currentBuild.github_run_id) {
                    await stream.sleep(2000);
                    continue;
                }
            }

            try {
                // 1. Get jobs for run
                const jobsRes = await fetch(`https://api.github.com/repos/${build.repo}/actions/runs/${currentBuild.github_run_id}/jobs`, {
                    headers: {
                        Authorization: `Bearer ${installationToken}`,
                        Accept: 'application/vnd.github+json',
                        'User-Agent': 'Plutoploy/1.0',
                    }
                });
                
                if (jobsRes.ok) {
                    const jobsData = await jobsRes.json() as any;
                    if (jobsData.jobs && jobsData.jobs.length > 0) {
                        const jobId = jobsData.jobs[0].id;
                        
                        // 2. Fetch logs for job
                        const logsRes = await fetch(`https://api.github.com/repos/${build.repo}/actions/jobs/${jobId}/logs`, {
                            headers: {
                                Authorization: `Bearer ${installationToken}`,
                                Accept: 'application/vnd.github+json',
                                'User-Agent': 'Plutoploy/1.0',
                            }
                        });
                        
                        if (logsRes.ok) {
                            const text = await logsRes.text();
                            const lines = text.split('\n');
                            
                            for (let i = lastLogLine; i < lines.length; i++) {
                                // Ignore empty lines to prevent spam
                                if (lines[i].trim()) {
                                    await stream.writeSSE({ data: lines[i] });
                                }
                            }
                            lastLogLine = lines.length;
                        } else if (logsRes.status !== 404) {
                            await stream.writeSSE({ data: `Fetching logs... (Status: ${currentBuild.status})` });
                        }
                    }
                }
            } catch (err) {
                console.error('[SSE Logs] Error fetching logs:', err);
            }

            if (!isCompleted) {
                await stream.sleep(3000);
            }
        }
        
        const finalBuild = buildsDb.getById(buildId) as any;
        const finalStatus = finalBuild?.status === 'success' ? 'SUCCESS' : 'FAILED';
        await stream.writeSSE({ data: `--- BUILD ${finalStatus} ---` });
    });
});

export { githubRoutes };
