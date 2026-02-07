# Mistakes & Corrections Log

## CP6 -> CP6.1 Transition
- **Mistake:** CP6 was marked "Complete" based on implementation code alone, without observational verification.
- **Impact:** Potential false confidence in broken features (e.g., Perception, Agent Loop).
- **Correction:** Introduced "CP6.1 - Observation & Automation Truth Layer". Mandated Playwright verification before acceptance.
- **Lesson:** "If something is not observable, it does not exist."

## CP7 Close
- **Mistake:** CP7 execution completed without saving the final ticket history state for tickets CP7-7 to CP7-15.
- **Impact:** Loss of governance trail for the final verification steps of CP7.
- **Correction:** Manually acknowledged in CP8 initiation. Future checkpoints must enforce a specific "Save History" step before "Exit Plan Mode".
- **Lesson:** Governance artifacts must be committed *before* declaring victory.
