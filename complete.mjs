// Complete function - marks task done and notifies owner

export default async (req, context) => {
    const SUPABASE_URL = Netlify.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Netlify.env.get("SUPABASE_ANON_KEY");
    const RESEND_KEY = Netlify.env.get("RESEND_API_KEY");
    const SITE_URL = Netlify.env.get("URL") || "https://taskdrop.netlify.app";

    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
    };

    if (req.method === "OPTIONS") {
        return new Response(null, { status: 200, headers });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
    }

    const supabaseHeaders = {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };

    try {
        const { token, notes } = await req.json();

        if (!token) {
            return new Response(JSON.stringify({ error: "Token required" }), { status: 400, headers });
        }

        // Get the task
        const taskRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?token=eq.${token}`, { headers: supabaseHeaders });
        const tasks = await taskRes.json();

        if (!tasks.length) {
            return new Response(JSON.stringify({ error: "Task not found" }), { status: 404, headers });
        }

        const task = tasks[0];

        // Mark as completed
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${task.id}`, {
            method: "PATCH",
            headers: supabaseHeaders,
            body: JSON.stringify({
                completed: true,
                completed_at: new Date().toISOString(),
                completion_notes: notes || null
            })
        });

        // Get project and owner info
        const projRes = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${task.project_id}`, { headers: supabaseHeaders });
        const projects = await projRes.json();
        const project = projects[0];

        // Send notification email to owner
        if (RESEND_KEY && project && project.owner_email) {
            const projectUrl = `${SITE_URL}?project=${project.id}`;
            
            try {
                await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${RESEND_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        from: "TaskDrop <onboarding@resend.dev>",
                        to: project.owner_email,
                        subject: `✓ Task completed: "${task.title}"`,
                        html: `
                            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                <div style="background: linear-gradient(135deg, #00d26a, #00b359); padding: 20px; border-radius: 12px 12px 0 0;">
                                    <h1 style="color: white; margin: 0; font-size: 24px;">✓ Task Complete!</h1>
                                </div>
                                
                                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
                                    <p style="color: #666; margin-bottom: 20px;">A task in <strong>${project.name}</strong> has been completed.</p>
                                    
                                    <div style="background: white; border: 1px solid #eee; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                                        <h3 style="margin: 0 0 10px 0; color: #1a1a2e;">${task.title}</h3>
                                        ${task.assignee_name ? `<p style="color: #666; margin: 0 0 10px 0;">Completed by: <strong>${task.assignee_name}</strong></p>` : ''}
                                        ${task.assignee_email ? `<p style="color: #666; margin: 0 0 10px 0;">${task.assignee_email}</p>` : ''}
                                        ${notes ? `<p style="color: #666; margin: 10px 0 0 0; padding: 10px; background: #f5f5f5; border-radius: 4px; font-style: italic;">"${notes}"</p>` : ''}
                                    </div>
                                    
                                    <a href="${projectUrl}" style="display: inline-block; background: linear-gradient(135deg, #e94560, #ff6b6b); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">
                                        View Project
                                    </a>
                                </div>
                            </div>
                        `
                    })
                });
            } catch (emailError) {
                console.error("Notification email error:", emailError);
            }
        }

        return new Response(JSON.stringify({ success: true }), { status: 200, headers });

    } catch (error) {
        console.error("Complete error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
};

export const config = {
    path: "/.netlify/functions/complete"
};
