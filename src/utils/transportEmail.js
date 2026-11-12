/**
 * Builds a Gmail compose URL pre-filled with the transport acceptance email.
 * @param {Object} request - Transport request data from your database
 * @param {string} request.requesterName
 * @param {string} request.requesterEmail
 * @param {string} request.date        - e.g. "2025-06-09" or pre-formatted string
 * @param {string} request.time        - e.g. "10:30 AM"
 * @param {string} request.location
 * @param {string} request.driverName
 * @param {string} request.driverContact
 * @returns {string} Gmail compose URL
 */
function formatDateWords(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const day = date.getDate();
  const suffix = (day % 10 === 1 && day !== 11) ? 'st' : (day % 10 === 2 && day !== 12) ? 'nd' : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
  return `${months[date.getMonth()]} ${day}${suffix} ${date.getFullYear()}`;
}

function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function buildTransportEmailURL(request) {
  const {
    requesterName,
    requesterEmail,
    date,
    time,
    location,
    driverName,
    driverContact,
  } = request;

  const subject = "Transport Request Accepted";

  const body = `Dear ${requesterName},

Thank you for submitting your transportation request to the USC Transport Department.

We are pleased to inform you that your request has been reviewed and approved. Please take note of the details below and ensure that all relevant parties are informed ahead of time.

──────────────────────────
🚌  TRANSPORT DETAILS
──────────────────────────
📅  Date:       ${formatDateWords(date)}
🕓  Time:       ${formatTime12h(time)}
📍  Location:   ${location}
👤  Driver:     ${driverName}
📞  Contact:    ${driverContact}
──────────────────────────

Please ensure that all passengers are present at the designated location at least 10 minutes before the scheduled departure time. Any changes to the arrangement should be communicated to the Transport Department as soon as possible.

For further assistance, please do not hesitate to reach out:
📞  868-662-2241, Ext. 1228 or 1262
✉️  transport@usc.edu.tt

We wish you safe travels and thank you for using USC Transport Services.

Warm regards,
USC Transport Department
University of the Southern Caribbean`;

  const params = new URLSearchParams({
    to: requesterEmail,
    su: subject,
    body,
  });

  return `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
}

/**
 * Opens Gmail compose in a new tab with the transport email pre-filled.
 * Call this directly from your button's onClick.
 * @param {Object} request - Transport request data from your database
 */
export function openTransportEmailInGmail(request) {
  const url = buildTransportEmailURL(request);
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Builds a Gmail compose URL pre-filled with the transport decline email.
 * @param {Object} request - Transport request data from your database
 * @param {string} request.requesterName
 * @param {string} request.requesterEmail
 * @returns {string} Gmail compose URL
 */
export function buildDeclineEmailURL(request) {
  const { requesterName, requesterEmail } = request;

  const subject = "Transport Request Declined";

  const body = `Dear ${requesterName},

Thank you for submitting your transportation request to the USC Transport Department.

After careful review, we regret to inform you that we are unable to fulfill your request at this time. We apologize for any inconvenience this may cause and encourage you to plan accordingly.

For further assistance or to discuss alternative arrangements, please do not hesitate to reach out to the Transport Department directly:

📞  868-662-2241, Ext. 1228 or 1262
✉️  transport@usc.edu.tt

We appreciate your understanding and remain committed to supporting the USC community.

Warm regards,
USC Transport Department
University of the Southern Caribbean`;

  const params = new URLSearchParams({
    to: requesterEmail,
    su: subject,
    body,
  });

  return `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
}

/**
 * Opens Gmail compose in a new tab with the transport decline email pre-filled.
 * @param {Object} request - Transport request data from your database
 */
export function openDeclineEmailInGmail(request) {
  const url = buildDeclineEmailURL(request);
  window.open(url, "_blank", "noopener,noreferrer");
}
