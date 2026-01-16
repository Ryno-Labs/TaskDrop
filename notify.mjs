// Netlify Function: notify
// Sends email notification when a task is completed
// Uses Resend for email delivery (you'll need to add RESEND_API_KEY to env vars)

export default async (req, context) => {
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

    try {
        const { project, task } = await req.json();
        
        // Check if owner email exists
        if (!project.ownerEmail) {
            console.log("No owner email configured, skipping notification");
            return new Response(JSON.stringify({ success: true, message: "No email configured" }), { status: 200, headers });
        }

        // Check for Resend API key
        const resendKey = Netlify.env.get("RESEND_API_KEY");
        
        if (!resendKey) {
            // Log for development - in production you'd want this configured
            console.log(`[DEV] Would send email to ${project.ownerEmail}:`);
            console.log(`  Subject: Task completed in "${project.name}"`);
            console.log(`  Task: ${task.title}`);
            return new Response(JSON.stringify({ 
                success: true, 
                message: "Email would be sent (RESEND_API_KEY not configured)" 
            }), { status: 200, headers });
        }

        // Send email via Resend
        const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: "TaskDrop <notifications@yourdomain.com>", // Update with your verified domain
                to: project.ownerEmail,
                subject: `✓ Task completed: "${task.title}"`,
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #e94560, #ff6b6b); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                            <h1 style="color: white; margin: 0; font-size: 24px;">TaskDrop</h1>
                        </div>
                        
                        <div style="background: #f5f5f7; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                            <h2 style="margin: 0 0 10px 0; color: #1a1a2e;">Task Completed! ✓</h2>
                            <p style="margin: 0; color: #666;">A task in your project has been marked as done.</p>
                        </div>
                        
                        <div style="border: 1px solid #eee; padding: 20px; border-radius: 12px;">
                            <p style="margin: 0 0 5px 0; color: #888; font-size: 14px;">PROJECT</p>
                            <p style="margin: 0 0 15px 0; font-weight: bold; color: #1a1a2e;">${project.name}</p>
                            
                            <p style="margin: 0 0 5px 0; color: #888; font-size: 14px;">COMPLETED TASK</p>
                            <p style="margin: 0 0 15px 0; font-weight: bold; color: #00d26a;">${task.title}</p>
                            
                            ${task.assignee ? `
                            <p style="margin: 0 0 5px 0; color: #888; font-size: 14px;">COMPLETED BY</p>
                            <p style="margin: 0; color: #1a1a2e;">${task.assignee}</p>
                            ` : ''}
                        </div>
                        
                        <p style="text-align: center; color: #888; font-size: 12px; margin-top: 20px;">
                            Sent by TaskDrop • <a href="${Netlify.env.get("URL") || 'https://taskdrop.netlify.app'}" style="color: #e94560;">View Project</a>
                        </p>
                    </div>
                `
            })
        });

        if (!emailResponse.ok) {
            const error = await emailResponse.text();
            console.error("Resend error:", error);
            return new Response(JSON.stringify({ success: false, error }), { status: 500, headers });
        }

        return new Response(JSON.stringify({ success: true, message: "Email sent" }), { status: 200, headers });

    } catch (error) {
        console.error("Notify function error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
};

export const config = {
    path: "/.netlify/functions/notify"
};
