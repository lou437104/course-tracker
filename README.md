# course-tracker

A lightweight, local-first **Course Accountability Tracker** (profile + accountability preferences + course list with progress bars and “on-track” pacing).

## Run it

Option A (recommended):

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173/` in your browser.

Option B:
- Open `index.html` directly in a browser (some browsers may restrict `import/export` file behaviors when opened as a local file).

## What it includes

- **User profile**
  - Learning goal textarea
  - Realistic time dedication dropdown
  - Best time to study checkboxes
  - “What makes you quit?” checkboxes
- **Accountability preferences**
  - Accountability style checkboxes (daily reminders, tough love, etc.)
  - Reminder method checkboxes (email/SMS/push/Slack/Discord)
  - Reminder time picker + weekends toggle
  - Progress logging method dropdown
  - Optional **OpenAI API key** field (auto-generate the daily coach message)
  - A motivating **Start Tracking** button (orange)
- **Courses**
  - Add / edit / delete courses
  - Platform dropdown + priority + “why”
  - Optional URL, duration, start + target completion dates
  - Progress as **percent** or **module X of Y**
  - Progress bar + pacing estimate (“Expected by now: …%”)
  - Milestone toasts at 25/50/75/100%
- **Study log + daily analysis**
  - Log study sessions (date + minutes + optional course + notes)
  - Shows last 7/30 day totals + current streak
  - “Run Daily Analysis” generates a coach message matching your style
  - Auto-runs once per day when you open the page (after you click Start Tracking)
  - Copy buttons for the GPT prompt + the message
- **Local-first storage**
  - Everything saves to your browser via `localStorage`
  - Export/import JSON from the top bar
