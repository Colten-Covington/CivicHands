import { setNeedHidden, updateNeedStatus } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { statusLabels } from "@/lib/needs";

/** Report management for city officials and administrators. Every change is written to the audit log. */
export function StaffNeedControls({ needId, status, hidden }: { needId: string; status: string; hidden: boolean }) {
  return <div className="staff-controls">
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
