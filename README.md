# TaskDrop

**Send tasks. Get notified when done.**

A simple task delegation tool for anyone who needs to assign tasks and know when they're complete.

## Quick Start

### Option 1: Deploy to Netlify (Recommended)

1. Push this folder to a GitHub repository
2. Go to [app.netlify.com](https://app.netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect your GitHub and select the repo
5. Click "Deploy site"

That's it! Netlify will automatically:
- Build the site
- Set up the serverless functions
- Enable Netlify Blobs for data storage

### Option 2: Drag and Drop

1. Zip this entire folder
2. Go to [app.netlify.com](https://app.netlify.com)
3. Drag the zip file onto the page

Note: Functions won't work with drag-and-drop. You'll need to connect via GitHub for full functionality.

## Enable Email Notifications (Optional)

To get email notifications when tasks are completed:

1. Create a free account at [resend.com](https://resend.com)
2. Get your API key
3. In Netlify dashboard, go to Site settings → Environment variables
4. Add: `RESEND_API_KEY` = your_api_key
5. Verify a domain in Resend, then update the `from` address in `netlify/functions/notify.mjs`

## How It Works

**For Project Owners (You):**
1. Create a project
2. Add tasks with details, links, locations
3. Share the project link with your team/family
4. Get notified when tasks are completed

**For Task Doers (Recipients):**
1. Click the shared link
2. See all task details
3. Mark tasks complete
4. Owner gets notified automatically

## Features

- ✅ Create projects with multiple tasks
- ✅ Add rich details: descriptions, links, locations
- ✅ Progress tracking with visual progress bar
- ✅ Share via unique URL (no login needed for doers)
- ✅ Edit tasks after creation
- ✅ Mark tasks complete/incomplete
- ✅ Email notifications on completion
- ✅ Works on mobile and desktop
- ✅ Data persists in Netlify Blobs

## File Structure

```
taskdrop/
├── index.html              # Main app (React SPA)
├── netlify.toml            # Netlify configuration
├── package.json            # Dependencies
└── netlify/
    └── functions/
        ├── projects.mjs    # CRUD for projects
        └── notify.mjs      # Email notifications
```

## Local Development

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Install dependencies
npm install

# Run locally with functions
netlify dev
```

## Tech Stack

- **Frontend:** React 18, Tailwind CSS
- **Backend:** Netlify Functions (serverless)
- **Storage:** Netlify Blobs
- **Email:** Resend (optional)

---

Built for getting things done. No complexity, just results.
