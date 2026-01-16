// Projects function - CRUD for projects using Supabase

export default async (req, context) => {
    const SUPABASE_URL = Netlify.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Netlify.env.get("SUPABASE_ANON_KEY");

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

        // GET - fetch projects
        if (req.method === "GET") {
            const id = url.searchParams.get("id");
            const owner = url.searchParams.get("owner");

            let endpoint = `${SUPABASE_URL}/rest/v1/projects`;
            
            if (id) {
                endpoint += `?id=eq.${id}`;
            } else if (owner) {
                endpoint += `?owner_email=eq.${encodeURIComponent(owner)}&order=created_at.desc`;
            } else {
                endpoint += `?order=created_at.desc`;
            }

            const res = await fetch(endpoint, { headers: supabaseHeaders });
            const data = await res.json();

            if (id) {
                return new Response(JSON.stringify(data[0] || { error: "Project not found" }), { status: data[0] ? 200 : 404, headers });
            }
            return new Response(JSON.stringify(data), { status: 200, headers });
        }

        // POST - create project
        if (req.method === "POST") {
            const body = await req.json();
            
            const res = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
                method: "POST",
                headers: supabaseHeaders,
                body: JSON.stringify({
                    name: body.name,
                    description: body.description || null,
                    owner_email: body.owner_email
                })
            });

            const data = await res.json();
            return new Response(JSON.stringify(data[0] || data), { status: 201, headers });
        }

        // DELETE - delete project
        if (req.method === "DELETE") {
            const id = url.searchParams.get("id");
            if (!id) {
                return new Response(JSON.stringify({ error: "ID required" }), { status: 400, headers });
            }

            await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${id}`, {
                method: "DELETE",
                headers: supabaseHeaders
            });

            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

    } catch (error) {
        console.error("Projects error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
};

export const config = {
    path: "/.netlify/functions/projects"
};
