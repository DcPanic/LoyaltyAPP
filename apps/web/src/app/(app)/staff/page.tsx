import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActionForm } from '@/components/ActionForm';
import { inviteStaffAction, removeStaffAction, updateStaffAction } from '@/app/actions/admin';

interface StaffMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  locationIds: string[];
  isActive: boolean;
  lastLoginAt: string | null;
}

interface Invite {
  id: string;
  name: string;
  email: string;
  role: string;
  expiresAt: string;
}

interface LocationItem {
  id: string;
  name: string;
}

export const metadata = { title: 'Staff — LoyaltyApp' };

export default async function StaffPage() {
  await requirePermission('staff:manage');
  const [staff, locations] = await Promise.all([
    api<{ items: StaffMember[]; invites: Invite[] }>('/v1/staff'),
    api<{ items: LocationItem[] }>('/v1/business/locations'),
  ]);

  return (
    <>
      <div className="topbar">
        <h1>Staff</h1>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Your team</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Locations</th>
                <th>Last sign-in</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {staff.items.map((member) => (
                <tr key={member.id}>
                  <td>
                    <strong>{member.name}</strong>
                    <br />
                    <small className="hint">{member.email}</small>
                  </td>
                  <td>
                    <ActionForm
                      action={updateStaffAction}
                      submitLabel="Save"
                      className="btn ghost"
                    >
                      <input type="hidden" name="id" value={member.id} />
                      <select name="role" defaultValue={member.role} disabled={member.role === 'OWNER'}>
                        <option value="OWNER">Owner</option>
                        <option value="MANAGER">Manager</option>
                        <option value="STAFF">Staff (stamp only)</option>
                      </select>
                    </ActionForm>
                  </td>
                  <td>
                    <small className="hint">
                      {member.locationIds.length === 0
                        ? 'All locations'
                        : member.locationIds
                            .map((id) => locations.items.find((l) => l.id === id)?.name ?? '—')
                            .join(', ')}
                    </small>
                  </td>
                  <td>
                    <small>
                      {member.lastLoginAt
                        ? new Date(member.lastLoginAt).toLocaleDateString()
                        : 'never'}
                    </small>
                  </td>
                  <td>
                    <span className={`badge ${member.isActive ? 'ok' : 'off'}`}>
                      {member.isActive ? 'active' : 'disabled'}
                    </span>
                  </td>
                  <td>
                    {member.role !== 'OWNER' && member.isActive && (
                      <ActionForm
                        action={removeStaffAction}
                        submitLabel="Remove"
                        className="btn ghost"
                      >
                        <input type="hidden" name="id" value={member.id} />
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {staff.invites.length > 0 && (
          <>
            <h3 style={{ marginTop: '1.5rem' }}>Pending invitations</h3>
            <div className="table-wrap">
              <table>
                <tbody>
                  {staff.invites.map((invite) => (
                    <tr key={invite.id}>
                      <td>
                        <strong>{invite.name}</strong>
                        <br />
                        <small className="hint">{invite.email}</small>
                      </td>
                      <td>{invite.role.toLowerCase()}</td>
                      <td>
                        <small className="hint">
                          expires {new Date(invite.expiresAt).toLocaleDateString()}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Invite a staff member</h2>
        </div>
        <p className="hint">
          Staff can stamp cards and look up customers. They cannot see billing, settings, analytics,
          campaigns or the customer export — on the web or in the mobile app.
        </p>
        <ActionForm action={inviteStaffAction} submitLabel="Create invitation">
          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="role">Role</label>
              <select id="role" name="role" defaultValue="STAFF">
                <option value="STAFF">Staff (stamp only)</option>
                <option value="MANAGER">Manager</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>
            <div className="field">
              <label>Location access</label>
              {locations.items.map((l) => (
                <label key={l.id} className="checkbox">
                  <input type="checkbox" name="locationIds" value={l.id} />
                  <span>{l.name}</span>
                </label>
              ))}
              <small className="hint">Leave empty for access to all locations.</small>
            </div>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
