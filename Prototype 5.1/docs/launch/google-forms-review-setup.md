# Prototype 5.1 Google Forms Review Setup

Prototype 5.1 Phase 1 uses a Google Form connected to Google Sheets. The website opens the form from the navbar **Leave Review** button and prompts students again after they export PDF or Excel.

## 1. Create the Google Form

Use Artem's Google account and create a form named something like:

`UCSC Course Scheduler Student Review`

Suggested description:

> Thank you for trying the UCSC Course Selection Automation website. Your honest feedback helps us improve the scheduler. Please do not include student ID numbers, passwords, or sensitive personal information. This website is not official academic advising.

## 2. Add these questions

Recommended questions:

1. **Overall, how would you rate the website?**
   - Type: Linear scale
   - Scale: 1 to 10
   - Labels: 1 = Not useful, 10 = Extremely useful
   - Required: Yes

2. **What major were you planning for?**
   - Type: Short answer or dropdown
   - Required: Recommended

3. **What student level are you?**
   - Type: Multiple choice
   - Options: Freshman, Sophomore, Junior, Senior, Transfer student, Graduate student, Other / not sure
   - Required: Recommended

4. **Did the generated schedule feel useful?**
   - Type: Multiple choice
   - Options: Yes, Somewhat, No, I did not generate a schedule
   - Required: Yes

5. **Did anything look inaccurate, confusing, or risky?**
   - Type: Paragraph
   - Required: No

6. **What would you love us to fix or improve?**
   - Type: Paragraph
   - Required: Recommended

7. **What cool features should we add next?**
   - Type: Paragraph
   - Required: No

8. **Optional email if you want follow-up**
   - Type: Short answer
   - Required: No
   - Validation: Email, if enabled

9. **Consent / privacy acknowledgement**
   - Type: Checkbox
   - Option: `I understand this is not official academic advising and I will not include sensitive personal information.`
   - Required: Yes

## 3. Connect responses to Google Sheets

In Google Forms:

1. Open the form.
2. Go to **Responses**.
3. Click **Link to Sheets**.
4. Create a new spreadsheet.
5. Name it something like `UCSC Course Scheduler Reviews`.

This spreadsheet becomes the review storage database for Phase 1.

## 4. Send review notifications to Artem's email

In Google Forms:

1. Open the form.
2. Go to **Responses**.
3. Click the three-dot menu.
4. Enable **Get email notifications for new responses**.

This sends an email to the Google account owner whenever a student submits a review.

If Artem wants notifications sent to a different email address, add that email as a collaborator/owner of the form or use a Google Sheets notification rule / Apps Script later.

## 5. Get the public form link

1. Click **Send** in Google Forms.
2. Select the link icon.
3. Copy the short `https://forms.gle/...` link or long `https://docs.google.com/forms/...` link.

## 6. Connect the form to Prototype 5.1

Replace the placeholder in:

`Prototype 5.1/js/app.js`

Change:

```js
const REVIEW_FORM_URL = "https://forms.gle/REPLACE_WITH_YOUR_GOOGLE_FORM_LINK";
```

to:

```js
const REVIEW_FORM_URL = "https://forms.gle/YOUR_REAL_FORM_LINK";
```

Then rerun:

```bash
cd "Prototype 5.1"
node test_p5_ui_upgrades.js
node test_export_availability.js
node test_smoke.js
```

## Current implementation behavior

- Navbar has a right-side **Leave Review** button.
- After a successful PDF export, the app opens a review invitation modal.
- After a successful Excel export, the app opens a review invitation modal.
- If the Google Form URL is still the placeholder, the modal shows setup instructions instead of pretending reviews are live.
- The form opens in a new tab with safe `noopener,noreferrer` behavior.

## Phase 1 limitations

- Reviews are stored in Google Sheets, not in the website code.
- Public review display is not implemented yet.
- Moderation is manual through the Google Sheet.
- Email notifications are controlled by Google Forms settings.

## Future Phase 2 idea

If the review system becomes a real public website feature, migrate from Google Forms to Supabase with:

- `reviews` table
- `pending` / `approved` / `rejected` moderation status
- spam protection
- admin-only moderation page
- public display of approved reviews only
