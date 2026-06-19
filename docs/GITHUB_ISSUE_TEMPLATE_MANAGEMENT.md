# GitHub Issue Template Management Process

This document outlines the process for managing GitHub Issue templates within the Aetheron Sentinel L3 repository. Well-maintained templates streamline issue reporting, ensure necessary information is collected, and guide users to appropriate channels.

## 1. Purpose of Issue Templates

GitHub Issue templates serve several key purposes:

- **Guidance:** Help users and contributors provide all necessary information when reporting bugs, requesting features, or asking questions.
- **Efficiency:** Reduce back-and-forth communication by ensuring initial reports are comprehensive.
- **Categorization:** Automatically apply labels and assignees to new issues, aiding in triage.
- **Redirection:** Guide users to alternative, more appropriate channels (e.g., private security reports, discussions for general questions).
- **Consistency:** Maintain a professional and organized issue tracker.

## 2. When to Create New Templates

New issue templates should be created when:

- **A new type of recurring issue emerges:** If you frequently receive reports that don't fit existing templates, a new one might be needed.
- **A new reporting channel is established:** For example, if a new service or component requires specific reporting guidelines.
- **Specific information is consistently missing:** If a particular piece of data is always requested by maintainers, add it to a new or existing template.
- **A need for redirection arises:** To guide users away from public issues for sensitive reports (e.g., security vulnerabilities).

**Before creating a new template, consider:**

- Can an existing template be modified to fit the new need?
- Is the new issue type distinct enough to warrant its own template?
- Will the new template genuinely improve the reporting process?

## 3. How to Update Existing Templates

Existing templates should be updated to:

- **Improve clarity:** Refine language, add examples, or simplify instructions.
- **Add/remove fields:** Include new required information or remove obsolete sections.
- **Update links:** Ensure all internal and external links are current and functional.
- **Reflect process changes:** If a workflow changes (e.g., new triage labels, different contact emails), update the template accordingly.
- **Address common user errors:** If users frequently misuse a template or omit crucial details, adjust the template to guide them better.

**Update Process:**

1. **Draft Changes:** Create a new branch and modify the `.github/ISSUE_TEMPLATE/*.md` file(s).
2. **Review:** Get feedback from relevant team members (e.g., security team for security templates, development team for bug reports).
3. **Test (Optional but Recommended):** Create a draft issue using the modified template to ensure it functions as expected.
4. **Submit PR:** Create a pull request with a clear description of the changes and why they are being made.
5. **Merge:** Once approved, merge the PR to apply the updated template.

## 4. Template Naming Conventions & Structure

- **File Naming:** Use clear, descriptive, and lowercase filenames with underscores (e.g., `bug_report.md`, `feature_request.md`, `security_vulnerability.md`).
- **Header:** Include `---` YAML front matter with `name`, `about`, `title`, `labels`, and `assignees`.
- **Clear Instructions:** Start with a concise summary of the template's purpose.
- **Sections:** Use markdown headings (`##`) to break down the report into logical sections.
- **Checklists:** Use GitHub markdown checklists (`- [ ]`) for required steps or information.
- **Placeholders:** Use placeholders (e.g., `[Describe the bug]`) to guide user input.
- **Examples:** Provide brief examples where appropriate to clarify expectations.
- **Redirection:** For sensitive topics (like security), clearly state the correct reporting channel at the top.

## 5. Review and Maintenance

- **Regular Review:** Templates should be reviewed at least **quarterly** or after any significant project changes (e.g., new features, major releases, process updates).
- **Feedback Loop:** Monitor incoming issues to identify if templates are effectively serving their purpose. Gather feedback from maintainers and users.
- **Archiving:** Deprecated templates should be moved to an `archive/` subdirectory within `.github/ISSUE_TEMPLATE/` or clearly marked as deprecated.

---

_For more information on our security practices, see SECURITY.md._
