// Netlify Function: projects
// Handles project CRUD operations using Netlify Blobs for persistence

import { getStore } from "@netlify/blobs";

export default async (req, context) => {
    const store = getStore("taskdrop-projects");
    const url = new URL(req.url);
    const projectId = url.searchParams.get("id");

    // CORS headers
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Content-Type": "application/json"
    };

    // Handle preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 200, headers });
    }

    try {
        // GET - Retrieve project(s)
        if (req.method === "GET") {
            if (projectId) {
                // Get single project
                const project = await store.get(projectId, { type: "json" });
                if (!project) {
                    return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers });
                }
                return new Response(JSON.stringify(project), { status: 200, headers });
            } else {
                // Get all projects (list all blobs)
                const { blobs } = await store.list();
                const projects = await Promise.all(
                    blobs.map(async (blob) => {
                        return await store.get(blob.key, { type: "json" });
                    })
                );
                return new Response(JSON.stringify(projects.filter(Boolean)), { status: 200, headers });
            }
        }

        // POST - Create/Update project
        if (req.method === "POST") {
            const project = await req.json();
            if (!project.id) {
                return new Response(JSON.stringify({ error: "Project ID required" }), { status: 400, headers });
            }
            await store.setJSON(project.id, project);
            return new Response(JSON.stringify(project), { status: 200, headers });
        }

        // DELETE - Remove project
        if (req.method === "DELETE") {
            if (!projectId) {
                return new Response(JSON.stringify({ error: "Project ID required" }), { status: 400, headers });
            }
            await store.delete(projectId);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

    } catch (error) {
        console.error("Projects function error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
};

export const config = {
    path: "/.netlify/functions/projects"
};
