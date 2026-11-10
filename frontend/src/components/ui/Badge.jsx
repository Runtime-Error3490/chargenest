const variants = {
  green: 'badge-green',
  yellow: 'badge-yellow',
  red: 'badge-red',
  blue: 'badge-blue',
  gray: 'badge-gray',
};

const statusColors = {
  // Booking statuses
  pending: 'yellow',
  authorized: 'blue',
  in_progress: 'blue',
  completed: 'green',
  cancelled: 'gray',
  no_show: 'red',
  disputed: 'red',
  
  // Session statuses
  awaiting_start: 'yellow',
  driver_confirmed: 'blue',
  host_confirmed: 'blue',
  ended: 'green',
  
  // Payment statuses
  captured: 'green',
  refunded: 'yellow',
  voided: 'gray',
  failed: 'red',
  
  // Charger statuses
  active: 'green',
  inactive: 'gray',
  maintenance: 'yellow',
  
  // Dispute statuses
  open: 'yellow',
  ai_reviewed: 'blue',
  pending_admin: 'yellow',
  resolved: 'green',
  closed: 'gray',
  
  // Mandate statuses
  revoked: 'red',
  expired: 'gray',
  used: 'gray',
};

export function Badge({ children, variant, status, className = '' }) {
  const color = variant || statusColors[status] || 'gray';
  
  return (
    <span className={`badge ${variants[color]} ${className}`}>
      {children || status?.replace(/_/g, ' ')}
    </span>
  );
}

export function StatusBadge({ status }) {
  const labels = {
    pending: 'Pending',
    authorized: 'Authorized',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
    disputed: 'Disputed',
    awaiting_start: 'Awaiting Start',
    driver_confirmed: 'Driver Confirmed',
    host_confirmed: 'Host Confirmed',
    ended: 'Ended',
    captured: 'Captured',
    refunded: 'Refunded',
    voided: 'Voided',
    failed: 'Failed',
    active: 'Active',
    inactive: 'Inactive',
    maintenance: 'Maintenance',
    open: 'Open',
    ai_reviewed: 'AI Reviewed',
    pending_admin: 'Pending Review',
    resolved: 'Resolved',
    closed: 'Closed',
    revoked: 'Revoked',
    expired: 'Expired',
    used: 'Used',
  };

  return (
    <Badge status={status}>
      {labels[status] || status}
    </Badge>
  );
}

export default Badge;
