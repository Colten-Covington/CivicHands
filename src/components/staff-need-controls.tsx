import { reviewNeed, setNeedHidden, updateNeedStatus } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { statusLabels } from "@/lib/needs";

/** Report management for moderators, city officials, and administrators. Every change is written to the audit log. */
export function StaffNeedControls({ needId, status, hidden, reviewStatus, hasReporter }: { needId: string; status: string; hidden: boolean; reviewStatus: string; hasReporter: boolean }) {
  return <div className="staff-controls">
    {reviewStatus !== "approved" && reviewStatus !== "rejected" && <ActionForm action={reviewNeed} submitLabel="Record review" className="action-form compact">
      <input type="hidden" name="needId" value={needId}/>
      <label>Decision<select name="decision" required defaultValue=""><option value="" disabled>Choose…</option><option value="approve">Approve and publish</option>{hasReporter && <option value="request_changes">Request wording changes</option>}<option value="reject">Decline report</option></select></label>
      <label>Moderator note (sent to the reporter only for wording requests)<textarea name="feedback" maxLength={500} placeholder={hasReporter ? "Ask for professional, respectful wording; explain what needs changing." : "Internal reason for declining; anonymous submitters cannot be contacted."}/></label>
      <label>Revised title (optional; publish with approval)<input name="revisedTitle" minLength={5} maxLength={100} placeholder="Use neutral, respectful wording"/></label>
      <label>Revised description (optional; publish with approval)<textarea name="revisedDescription" minLength={10} maxLength={1000}/></label>
    </ActionForm>}
    <ActionForm action={updateNeedStatus} submitLabel="Update report" className="action-form compact">
      <input type="hidden" name="needId" value={needId}/>
      <label>Status<select name="status" defaultValue={status}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Public update (shown on the report&apos;s history)<input name="publicNote" maxLength={500} placeholder="e.g. Public Works crew scheduled for Tuesday"/></label>
    </ActionForm>
    <ActionForm action={setNeedHidden} submitLabel={hidden ? "Restore to map" : "Hide from map"} buttonClassName="secondary-button" className="action-form compact">
      <input type="hidden" name="needId" value={needId}/>
      <input type="hidden" name="hidden" value={hidden ? "false" : "true"}/>
      <label>Moderation reason (staff only)<input name="reason" required minLength={3} maxLength={500} placeholder={hidden ? "Reviewed and appropriate" : "Duplicate, spam, or unsafe content"}/></label>
    </ActionForm>
  </div>;
}
