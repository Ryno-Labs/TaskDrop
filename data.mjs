// Single data function - handles all Supabase operations

export default async (req, context) => {
    const SUPABASE_URL = Netlify.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Netlify.env.get("SUPABASE_ANON_KEY");
    const RESEND_KEY = Netlify.env.get("RESEND_API_KEY");
    const SITE_URL = Netlify.env.get("URL") || "https://taskdrop.netlify.app";

    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Content-Type": "application/json"
    };

    if (req.method === "OPTIONS") {
        return new Response(null, { status: 200, headers });
    }

    const supabase = async (endpoint, method = "GET", body = null) => {
        const opts = {
            method,
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, opts);
        return res.json();
    };

    const sendEmail = async (to, subject, html) => {
        if (!RESEND_KEY) {
            console.log("No RESEND_KEY, skipping email to:", to);
            return;
        }
        try {
            await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${RESEND_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    from: "TaskDrop <onboarding@resend.dev>",
                    to,
                    subject,
                    html
                })
            });
        } catch (e) {
            console.error("Email error:", e);
        }
    };

    try {
        const url = new URL(req.url);

        // ============ GET REQUESTS ============
        if (req.method === "GET") {
            const action = url.searchParams.get("action");

            // Get projects for owner
            if (action === "getProjects") {
                const email = url.searchParams.get("email");
                const data = await supabase(`projects?owner_email=eq.${encodeURIComponent(email)}&order=created_at.desc`);
                return new Response(JSON.stringify(data), { headers });
            }

            // Get all tasks for owner (across all their projects + standalone)
            if (action === "getTasks") {
                const email = url.searchParams.get("email");
                // First get all projects owned by this email
                const projects = await supabase(`projects?owner_email=eq.${encodeURIComponent(email)}&select=id`);
                const projectIds = projects.map(p => p.id);
                
                // Get tasks that belong to those projects OR have no project (standalone)
                let tasks = [];
                if (projectIds.length > 0) {
                    tasks = await supabase(`tasks?or=(project_id.in.(${projectIds.join(",")}),project_id.is.null)&order=created_at.desc`);
                } else {
                    // If no projects, check for standalone tasks (would need owner_email on tasks for this)
                    // For now just return empty
                    tasks = [];
                }
                return new Response(JSON.stringify(tasks), { headers });
            }

            // Get task by token (for doer view)
            if (action === "getTask") {
                const token = url.searchParams.get("token");
                const tasks = await supabase(`tasks?token=eq.${token}`);
                
                if (!tasks.length) {
                    return new Response(JSON.stringify({ error: "Task not found" }), { status: 404, headers });
                }

                const task = tasks[0];
                let project = null;
                let allTasks = [task];

                if (task.project_id) {
                    const projects = await supabase(`projects?id=eq.${task.project_id}`);
                    project = projects[0] || null;
                    allTasks = await supabase(`tasks?project_id=eq.${task.project_id}&order=created_at.asc`);
                }

                return new Response(JSON.stringify({ task, project, allTasks }), { headers });
            }
        }

        // ============ POST REQUESTS ============
        if (req.method === "POST") {
            const body = await req.json();
            const action = body.action;

            // Create standalone task
            if (action === "createTask") {
                const taskData = {
                    title: body.title,
                    details: body.details || null,
                    links: body.links || [],
                    location: body.location || null,
                    assignee_name: body.assigneeName || null,
                    assignee_email: body.assigneeEmail,
                    status: "pending"
                };

                // If no project, we need to create a "virtual" project to track ownership
                // Actually let's create a real project for standalone tasks
                const project = await supabase("projects", "POST", {
                    name: body.title,
                    description: "Single task",
                    owner_email: body.ownerEmail
                });

                taskData.project_id = project[0].id;
                const tasks = await supabase("tasks", "POST", taskData);
                const task = tasks[0];

                // Send email to assignee
                const taskUrl = `${SITE_URL}?task=${task.token}`;
                await sendEmail(
                    body.assigneeEmail,
                    `New task assigned: "${body.title}"`,
                    `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #3b82f6;">You have a new task!</h2>
                        <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin: 0 0 10px 0;">${body.title}</h3>
                            ${body.details ? `<p style="color: #64748b;">${body.details}</p>` : ''}
                        </div>
                        <a href="${taskUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Task</a>
                        <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Link: ${taskUrl}</p>
                    </div>
                    `
                );

                return new Response(JSON.stringify(task), { headers });
            }

            // Create project with tasks
            if (action === "createProject") {
                // Create project
                const projects = await supabase("projects", "POST", {
                    name: body.name,
                    description: body.description || null,
                    owner_email: body.ownerEmail
                });
                const project = projects[0];

                // Create tasks
                for (const t of body.tasks) {
                    const taskData = {
                        project_id: project.id,
                        title: t.title,
                        assignee_name: t.assigneeName || null,
                        assignee_email: t.assigneeEmail,
                        status: "pending"
                    };
                    const tasks = await supabase("tasks", "POST", taskData);
                    const task = tasks[0];

                    // Send email to assignee
                    const taskUrl = `${SITE_URL}?task=${task.token}`;
                    await sendEmail(
                        t.assigneeEmail,
                        `New task in "${body.name}": ${t.title}`,
                        `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #3b82f6;">You have a new task!</h2>
                            <p style="color: #64748b;">Project: ${body.name}</p>
                            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin: 0;">${t.title}</h3>
                            </div>
                            <a href="${taskUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Task</a>
                            <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Link: ${taskUrl}</p>
                        </div>
                        `
                    );
                }

                return new Response(JSON.stringify(project), { headers });
            }

            // Update task status (accept/decline/complete)
            if (action === "updateStatus") {
                const { token, status, notes } = body;

                // Get task and project
                const tasks = await supabase(`tasks?token=eq.${token}`);
                if (!tasks.length) {
                    return new Response(JSON.stringify({ error: "Task not found" }), { status: 404, headers });
                }
                const task = tasks[0];

                // Update task
                const updateData = { status };
                if (status === "completed") {
                    updateData.completed_at = new Date().toISOString();
                    updateData.completion_notes = notes || null;
                }

                await supabase(`tasks?id=eq.${task.id}`, "PATCH", updateData);

                // Get project to find owner email
                if (task.project_id) {
                    const projects = await supabase(`projects?id=eq.${task.project_id}`);
                    const project = projects[0];

                    if (project && project.owner_email) {
                        // Send notification to owner
                        let subject, message;

                        if (status === "accepted") {
                            subject = `✓ Task accepted: "${task.title}"`;
                            message = `${task.assignee_name || task.assignee_email} has accepted the task.`;
                        } else if (status === "declined") {
                            subject = `✗ Task declined: "${task.title}"`;
                            message = `${task.assignee_name || task.assignee_email} has declined this task. You may want to reassign it.`;
                        } else if (status === "completed") {
                            subject = `✓ Task completed: "${task.title}"`;
                            message = `${task.assignee_name || task.assignee_email} has completed the task.${notes ? `<br><br>Notes: "${notes}"` : ''}`;
                        }

                        await sendEmail(
                            project.owner_email,
                            subject,
                            `
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: ${status === 'declined' ? '#ef4444' : '#10b981'};">${subject}</h2>
                                <p>${message}</p>
                                <p style="color: #64748b; margin-top: 20px;">Project: ${project.name}</p>
                            </div>
                            `
                        );
                    }
                }

                return new Response(JSON.stringify({ success: true }), { headers });
            }

            // Delete task
            if (action === "deleteTask") {
                await supabase(`tasks?id=eq.${body.id}`, "DELETE");
                return new Response(JSON.stringify({ success: true }), { headers });
            }

            // Delete project (cascade deletes tasks)
            if (action === "deleteProject") {
                await supabase(`projects?id=eq.${body.id}`, "DELETE");
                return new Response(JSON.stringify({ success: true }), { headers });
            }
        }

        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers });

    } catch (error) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
};

export const config = {
    path: "/.netlify/functions/data"
};
