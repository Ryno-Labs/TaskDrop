// Tasks function - CRUD for tasks, sends email on creation

export default async (req, context) => {
    const SUPABASE_URL = Netlify.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Netlify.env.get("SUPABASE_ANON_KEY");
    const RESEND_KEY = Netlify.env.get("RESEND_API_KEY");
    const SITE_URL = Netlify.env.get("URL") || "https://taskdrop.netlify.app";

    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Content-Type": "application/json"
    };

    if (req.method === "OPTIONS") {
        return new Response(null, { status: 200, headers });
    }

    const supabaseHeaders = {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };

    try {
        const url = new URL(req.url);

        // GET - fetch task(s)
        if (req.method === "GET") {
            const token = url.searchParams.get("token");
            const projectId = url.searchParams.get("project_id");
            const id = url.searchParams.get("id");

            if (token) {
                // Get task by token (public access for completion)
                const taskRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?token=eq.${token}`, { headers: supabaseHeaders });
                const tasks = await taskRes.json();
                
                if (!tasks.length) {
                    return new Response(JSON.stringify({ error: "Task not found" }), { status: 404, headers });
                }

                const task = tasks[0];

                // Get project info
                const projRes = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${task.project_id}`, { headers: supabaseHeaders });
                const projects = await projRes.json();

                // Get all tasks in project
                const allTasksRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?project_id=eq.${task.project_id}&order=created_at.asc`, { headers: supabaseHeaders });
                const allTasks = await allTasksRes.json();

                return new Response(JSON.stringify({
                    task,
                    project: projects[0] || null,
                    allTasks
                }), { status: 200, headers });
            }

            if (projectId) {
                // Get all tasks for a project
                const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?project_id=eq.${projectId}&order=created_at.asc`, { headers: supabaseHeaders });
                const data = await res.json();
                return new Response(JSON.stringify(data), { status: 200, headers });
            }

            if (id) {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}`, { headers: supabaseHeaders });
                const data = await res.json();
                return new Response(JSON.stringify(data[0] || { error: "Not found" }), { status: 200, headers });
            }

            return new Response(JSON.stringify({ error: "Missing query parameter" }), { status: 400, headers });
        }

        // POST - create task and send email
        if (req.method === "POST") {
            const body = await req.json();

            // Create task in Supabase
            const taskRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
                method: "POST",
                headers: supabaseHeaders,
                body: JSON.stringify({
                    project_id: body.project_id,
                    title: body.title,
                    details: body.details || null,
                    links: body.links || [],
                    location: body.location || null,
                    assignee_name: body.assignee_name || null,
                    assignee_email: body.assignee_email
                })
            });

            const tasks = await taskRes.json();
            const task = tasks[0];

            if (!task) {
                return new Response(JSON.stringify({ error: "Failed to create task" }), { status: 500, headers });
            }

            // Get project info for email
            const projRes = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${body.project_id}`, { headers: supabaseHeaders });
            const projects = await projRes.json();
            const project = projects[0];

            // Send email to assignee
            const taskUrl = `${SITE_URL}?task=${task.token}`;

            if (RESEND_KEY && body.assignee_email) {
                try {
                    await fetch("https://api.resend.com/emails", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${RESEND_KEY}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            from: "TaskDrop <onboarding@resend.dev>",
                            to: body.assignee_email,
                            subject: `New task for you: "${task.title}"`,
                            html: `
                                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                    <div style="background: linear-gradient(135deg, #e94560, #ff6b6b); padding: 20px; border-radius: 12px 12px 0 0;">
                                        <h1 style="color: white; margin: 0; font-size: 24px;">TaskDrop</h1>
                                    </div>
                                    
                                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
                                        <h2 style="margin: 0 0 10px 0; color: #1a1a2e;">You have a new task!</h2>
                                        
                                        ${project ? `<p style="color: #666; margin-bottom: 20px;">Project: <strong>${project.name}</strong></p>` : ''}
                                        
                                        <div style="background: white; border: 1px solid #eee; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                                            <h3 style="margin: 0 0 10px 0; color: #1a1a2e;">${task.title}</h3>
                                            ${task.details ? `<p style="color: #666; margin: 0;">${task.details}</p>` : ''}
                                            ${task.location ? `<p style="color: #666; margin: 10px 0 0 0;">📍 ${task.location}</p>` : ''}
                                        </div>
                                        
                                        <a href="${taskUrl}" style="display: inline-block; background: linear-gradient(135deg, #e94560, #ff6b6b); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">
                                            View & Complete Task
                                        </a>
                                        
                                        <p style="color: #999; font-size: 12px; margin-top: 20px;">
                                            Or copy this link: ${taskUrl}
                                        </p>
                                    </div>
                                </div>
                            `
                        })
                    });

                    // Mark email as sent
                    await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${task.id}`, {
                        method: "PATCH",
                        headers: supabaseHeaders,
                        body: JSON.stringify({ sms_sent: true })
                    });

                    task.sms_sent = true;
                } catch (emailError) {
                    console.error("Email error:", emailError);
                }
            }

            return new Response(JSON.stringify(task), { status: 201, headers });
        }

        // DELETE - delete task
        if (req.method === "DELETE") {
            const id = url.searchParams.get("id");
            if (!id) {
                return new Response(JSON.stringify({ error: "ID required" }), { status: 400, headers });
            }

            await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}`, {
                method: "DELETE",
                headers: supabaseHeaders
            });

            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

    } catch (error) {
        console.error("Tasks error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
};

export const config = {
    path: "/.netlify/functions/tasks"
};
